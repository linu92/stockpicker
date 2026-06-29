import requests
from bs4 import BeautifulSoup
import re
import pandas as pd
import time
import json
import functools
import FinanceDataReader as fdr
from datetime import datetime, timedelta
from sqlalchemy import text
from database import get_db_engine, is_postgres
import FinanceDataReader as fdr

def fetch_history(code, start_date):
    try:
        df = fdr.DataReader(code, start_date)
        if df.empty:
            return code, None
        return code, df
    except Exception:
        return code, None

def fetch_index(code):
    try:
        df = fdr.DataReader(code)
        return df[['Close']].rename(columns={'Close': code})
    except Exception:
        return None

def fetch_minute_data(code, market, interval="30m", period="60d"):
    import yfinance as yf
    yf_ticker = f"{code}.KS" if market in ['KOSPI', 'KOSPI200'] else f"{code}.KQ"
    try:
        df = yf.download(yf_ticker, period=period, interval=interval, progress=False)
        if not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.droplevel(1)
            if df.index.tz is not None:
                df.index = df.index.tz_convert('Asia/Seoul').tz_localize(None)
            df['Amount'] = df['Close'] * df['Volume']
            return df
    except:
        pass
    return None

# Simple in-memory cache for KRX listings
_krx_cache = None
_krx_cache_time = 0

def get_krx_listing():
    global _krx_cache, _krx_cache_time
    # Cache for 1 hour
    if _krx_cache is not None and time.time() - _krx_cache_time < 3600:
        return _krx_cache

    try:
        df = fdr.StockListing('KRX')
        # We need to map FDR columns to what the app expects: Code, Name, Close, Changes, ChagesRatio, Marcap, Volume, Market
        # FDR returns: Code, ISU_CD, Name, Market, Dept, Close, ChangeCode, Changes, ChagesRatio, Open, High, Low, Volume, Amount, Marcap, Stocks, MarketId
        
        # Select and rename to match existing structure
        df = df[['Code', 'Name', 'Close', 'Changes', 'ChagesRatio', 'Marcap', 'Volume', 'Market']]
        
        # Ensure Market is KOSPI or KOSDAQ for consistency
        df['Market'] = df['Market'].replace({'KOSPI': 'KOSPI', 'KOSDAQ': 'KOSDAQ', 'KOSDAQ GLOBAL': 'KOSDAQ'})
        
        _krx_cache = df
        _krx_cache_time = time.time()
        return df
    except Exception as e:
        print(f"Error fetching KRX listing: {e}")
        return pd.DataFrame()

def analyze_stock(code, df, min_amount_b, exclude_new_listing, use_step2, use_step2_1, use_step2_2, use_step3, step3_decline_min, step3_decline_max, use_step4, step4_vol_type, step4_vol_ratio, step4_vol_avg_days, use_step5, step2_ma_short=20, step2_ma_long=60, rising_ma10=False, rising_ma20=True, rising_ma50=False):
    ma_short = int(step2_ma_short)
    ma_long = int(step2_ma_long)
    min_len = max(65, ma_long + 5)
    
    if df is None or len(df) < min_len:
        return 1, None
        
    if exclude_new_listing and len(df) < 230:
        return 1, None
    
    df = df.copy()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA_short'] = df['Close'].rolling(window=ma_short).mean()
    df['MA_long'] = df['Close'].rolling(window=ma_long).mean()
    df['MA10'] = df['Close'].rolling(window=10).mean()
    df['MA50'] = df['Close'].rolling(window=50).mean()
    df['Amount'] = df['Close'] * df['Volume']
    
    recent = df.iloc[-1]
    
    avg_amount_20 = df['Amount'].tail(20).mean()
    if avg_amount_20 < min_amount_b * 100000000:
        return 1, None
        
    highest_20 = df['High'].tail(20).max()
    if highest_20 == 0: return 1, None

    if use_step2:
        if use_step2_1:
            if not (recent['Close'] > recent['MA_short'] and recent['MA_short'] > recent['MA_long']):
                return 1, None
        
        if use_step2_2:
            rising_checks = [(rising_ma10, 'MA10'), (rising_ma20, 'MA20'), (rising_ma50, 'MA50')]
            for enabled, col in rising_checks:
                if not enabled:
                    continue
                vals = df[col].tail(6).values
                if not all(vals[i] <= vals[i+1] for i in range(5)):
                    return 1, None
            
    if use_step3:
        decline = (recent['Close'] - highest_20) / highest_20
        if not (-step3_decline_max / 100 <= decline <= -step3_decline_min / 100):
            return 2, None
            
        avg_vol_3 = df['Volume'].tail(3).mean()
        avg_vol_prev_10 = df['Volume'].iloc[-13:-3].mean()
        if avg_vol_3 >= avg_vol_prev_10:
            return 2, None
            
        ma_dist = (recent['Close'] - recent['MA20']) / recent['MA20']
        if not (-0.03 <= ma_dist <= 0.03):
            return 2, None
            
    if use_step4:
        def has_lower_tail(row):
            hl_range = row['High'] - row['Low']
            if hl_range == 0: return False
            return (row['Close'] - row['Low']) / hl_range >= 0.5
            
        yesterday = df.iloc[-2]
        if not (has_lower_tail(recent) or has_lower_tail(yesterday)):
            return 3, None
            
        if step4_vol_type == "전일 대비":
            if recent['Volume'] < df['Volume'].iloc[-2] * step4_vol_ratio:
                return 3, None
        else:
            avg_vol = df['Volume'].tail(int(step4_vol_avg_days)).mean()
            if recent['Volume'] < avg_vol * step4_vol_ratio:
                return 3, None
            
        if (recent['High'] - recent['Close']) / recent['High'] > 0.03:
            return 3, None
            
    if use_step5:
        for i in range(1, 6):
            row = df.iloc[-i]
            prev_row = df.iloc[-i-1]
            if prev_row['Close'] == 0: continue
            if (row['Close'] - prev_row['Close']) / prev_row['Close'] >= 0.29:
                return 4, None
                
    return 5, df

def crawl_naver_news_search(keyword, start_date=None, end_date=None, stream=False):
    """네이버 금융 뉴스에서 기사를 크롤링하여 DB에 저장 (issue_map 방식)"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    db_keyword_label = keyword.strip() if keyword.strip() else "전체"
    
    if start_date and end_date:
        s_date = datetime.combine(start_date, datetime.min.time()) if not isinstance(start_date, datetime) else start_date
        e_date = datetime.combine(end_date, datetime.min.time()) if not isinstance(end_date, datetime) else end_date
    else:
        e_date = (datetime.utcnow() + timedelta(hours=9))
        s_date = e_date - timedelta(days=7)
    
    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT url FROM news WHERE keyword = :kw"), {"kw": db_keyword_label})
        existing_urls = {row[0] for row in result}
    
    total_days = (e_date - s_date).days + 1
    if total_days <= 0: total_days = 1
    
    all_news = []
    current_date = s_date
    delta = timedelta(days=1)
    
    current_day_idx = 0
    while current_date <= e_date:
        current_day_idx += 1
        date_param = current_date.strftime('%Y%m%d')
        
        if stream:
            yield json.dumps({"type": "progress", "current": current_day_idx, "total": total_days, "message": f"{date_param} 뉴스 수집 중..."}) + "\n"
            
        page = 1
        empty_count = 0
        
        while True:
            url = f'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=258&date={date_param}&page={page}'
            
            try:
                response = requests.get(url, headers=headers, timeout=10)
                response.encoding = 'euc-kr'
                soup = BeautifulSoup(response.text, 'html.parser')
                
                dls = soup.select('#contentarea_left dl')
                valid_dls = [dl for dl in dls if 'sub_tit_ticker' not in dl.get('class', [])]
                
                if not valid_dls:
                    empty_count += 1
                    if empty_count >= 2:
                        break
                    page += 1
                    continue
                
                empty_count = 0
                existing_count_on_page = 0
                
                for dl in valid_dls:
                    children = list(dl.find_all(recursive=False))
                    i = 0
                    while i < len(children):
                        child = children[i]
                        is_subject = (child.name in ('dt', 'dd') and 'articleSubject' in child.get('class', []))
                        
                        if is_subject:
                            subject_link = child.select_one('a')
                            if not subject_link:
                                i += 1
                                continue
                            
                            title = subject_link.text.strip()
                            relative_link = subject_link.get('href', '')
                            link = ('https://finance.naver.com' + relative_link).replace('\xa7', '&sect')
                            
                            if link in existing_urls:
                                existing_count_on_page += 1
                                i += 1
                                continue
                            
                            summary = ''
                            press = '네이버 금융'
                            wdate = current_date.strftime('%Y-%m-%d')
                            
                            if i + 1 < len(children) and children[i+1].name == 'dd' and 'articleSummary' in children[i+1].get('class', []):
                                import copy
                                summary_copy = copy.copy(children[i+1])
                                
                                press_span = summary_copy.select_one('.press')
                                wdate_span = summary_copy.select_one('.wdate')
                                
                                if press_span:
                                    press = press_span.text.strip()
                                    press_span.decompose()
                                if wdate_span:
                                    wdate_text = wdate_span.text.strip()
                                    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', wdate_text)
                                    if date_match:
                                        wdate = date_match.group(1)
                                    wdate_span.decompose()
                                
                                summary = summary_copy.text.replace('|', '').strip()
                                summary = re.sub(r'\s+', ' ', summary)
                                i += 2
                            else:
                                i += 1
                            
                            search_kw = keyword.strip()
                            if search_kw and search_kw != "전체":
                                if search_kw not in (title + ' ' + summary):
                                    continue
                            
                            all_news.append({
                                'title': title,
                                'url': link,
                                'source': press,
                                'published_date': wdate,
                                'summary': summary
                            })
                        else:
                            i += 1
                
                total_items = sum(len(dl.select('.articleSubject')) for dl in valid_dls)
                
                if total_items > 0 and existing_count_on_page == total_items:
                    break
                    
                if total_items < 10:
                    break
                    
                if stream:
                    yield json.dumps({"type": "progress", "current": current_day_idx, "total": total_days, "message": f"{date_param} - {page}페이지 탐색 중..."}) + "\n"
                    
                page += 1
                time.sleep(0.5)
                
            except Exception as e:
                break
        
        current_date += delta
        time.sleep(0.3)
    
    saved_count = 0
    with engine.connect() as conn:
        for item in all_news:
            try:
                if is_postgres():
                    res = conn.execute(text('''
                        INSERT INTO news (title, url, source, published_date, summary, keyword)
                        VALUES (:title, :url, :source, :published_date, :summary, :keyword)
                        ON CONFLICT (url) DO NOTHING
                    '''), {
                        "title": item['title'], "url": item['url'], "source": item['source'],
                        "published_date": item['published_date'], "summary": item['summary'], "keyword": db_keyword_label
                    })
                else:
                    res = conn.execute(text('''
                        INSERT OR IGNORE INTO news (title, url, source, published_date, summary, keyword)
                        VALUES (:title, :url, :source, :published_date, :summary, :keyword)
                    '''), {
                        "title": item['title'], "url": item['url'], "source": item['source'],
                        "published_date": item['published_date'], "summary": item['summary'], "keyword": db_keyword_label
                    })
                if res.rowcount > 0:
                    saved_count += 1
            except Exception:
                pass
        conn.commit()
    
    if stream:
        yield json.dumps({"type": "progress", "current": total_days, "total": total_days, "message": f"크롤링 완료! {saved_count}건 저장됨"}) + "\n"
    
    return all_news, saved_count

def fetch_article_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        real_url = url
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        
        if 'office_id' in qs and 'article_id' in qs:
            oid = qs['office_id'][0]
            aid = qs['article_id'][0]
            real_url = f"https://n.news.naver.com/mnews/article/{oid}/{aid}"
            res = requests.get(real_url, headers=headers, timeout=5)
        else:
            res = requests.get(url, headers=headers, timeout=5)
            res.encoding = 'euc-kr'
            match = re.search(r"href=['\"](https://n\.news\.naver\.com/.*?)['\"]", res.text)
            if match:
                real_url = match.group(1)
                res = requests.get(real_url, headers=headers, timeout=5)
                
        if 'charset=euc-kr' in res.headers.get('content-type', '').lower():
            res.encoding = 'euc-kr'
        else:
            res.encoding = 'utf-8'
        
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            
            title_tag = soup.select_one('#title_area')
            date_tag = soup.select_one('.media_end_head_info_datestamp_time')
            content_tag = soup.select_one('#dic_area')
            
            if not title_tag: title_tag = soup.select_one('.article_info h3')
            if not date_tag: date_tag = soup.select_one('.article_info .article_date')
            if not content_tag: content_tag = soup.select_one('#news_read')
            
            title = title_tag.text.strip() if title_tag else "제목을 불러올 수 없습니다."
            date_str = date_tag.text.strip() if date_tag else ""
            content_html = str(content_tag) if content_tag else "<p>본문을 불러올 수 없거나 지원하지 않는 기사 형식입니다.</p>"
            
            clean_soup = BeautifulSoup(content_html, 'html.parser')
            for script in clean_soup(["script", "style", "iframe", "button"]):
                script.decompose()
            
            clean_html = f"""
            <div style="font-family: 'Inter', sans-serif; line-height: 1.7; padding: 20px; color: #e0e0e0; background: #1e293b; border-radius: 10px;">
                <h2 style="border-bottom: 1px solid #334155; padding-bottom: 10px; color: #f8fafc; font-size: 1.5em; margin-top: 0;">{title}</h2>
                <p style="color: #94a3b8; font-size: 0.9em; margin-bottom: 25px;">{date_str}</p>
                <div style="font-size: 1.1em; overflow-wrap: break-word; color: #cbd5e1;">
                    {str(clean_soup)}
                </div>
            </div>
            """
            return clean_html
            
        return f"<h3>기사를 불러오지 못했습니다. (HTTP {res.status_code})</h3>"
    except Exception as e:
        return f"<h3>기사 로딩 중 오류가 발생했습니다: {str(e)}</h3>"
