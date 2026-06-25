import streamlit as st
import FinanceDataReader as fdr
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta
import numpy as np
import concurrent.futures
import requests
from bs4 import BeautifulSoup
import time
import re
import os
from sqlalchemy import create_engine, text

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'news.db') if '__file__' in dir() else 'news.db'

def get_db_engine():
    if 'connections' in st.secrets and 'supabase' in st.secrets['connections']:
        return create_engine(st.secrets['connections']['supabase']['url'])
    else:
        return create_engine(f'sqlite:///{DB_PATH}')

def is_postgres():
    return 'connections' in st.secrets and 'supabase' in st.secrets['connections']

def init_db():
    engine = get_db_engine()
    try:
        with engine.connect() as conn:
            if is_postgres():
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS news (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        url TEXT UNIQUE NOT NULL,
                        source TEXT NOT NULL,
                        published_date TEXT NOT NULL,
                        summary TEXT,
                        keyword TEXT
                    )
                '''))
                try:
                    conn.execute(text("ALTER TABLE news ADD COLUMN is_read BOOLEAN DEFAULT FALSE"))
                except:
                    pass
            else:
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS news (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        url TEXT UNIQUE NOT NULL,
                        source TEXT NOT NULL,
                        published_date TEXT NOT NULL,
                        summary TEXT,
                        keyword TEXT
                    )
                '''))
                try:
                    conn.execute(text("ALTER TABLE news ADD COLUMN is_read BOOLEAN DEFAULT FALSE"))
                except:
                    pass
            conn.commit()
    except Exception as e:
        import streamlit as st
        st.error(f"데이터베이스 연결 실패! 상세 에러: {str(e)}")

init_db()

if 'view_mode' not in st.session_state:
    st.session_state['view_mode'] = 'search'
if 'selected_article_url' not in st.session_state:
    st.session_state['selected_article_url'] = None

st.set_page_config(page_title="Korean Stock Picker", layout="wide", page_icon="📈")

st.title("📈 한국 주식 조건 검색기 (눌림목 타점)")
st.markdown("""
이 앱은 사용자가 지정한 5단계 조건(기본 필터, 추세 확인, 눌림 발생, 반등 신호, 제외 조건)을 만족하는 종목을 검색합니다.
검색 과정에서 데이터를 실시간으로 가져오므로 약 10~30초 정도 소요될 수 있습니다.
""")

# --- Sidebar ---
st.sidebar.header("📰 메인 화면 모드")
if st.session_state.get('view_mode', 'search') == 'search':
    if st.sidebar.button("📰 기사보기 모드로 전환", use_container_width=True):
        st.session_state['view_mode'] = 'news'
        st.rerun()
else:
    if st.sidebar.button("🔍 검색기로 돌아가기", use_container_width=True):
        st.session_state['view_mode'] = 'search'
        st.rerun()

st.sidebar.markdown("---")
st.sidebar.header("📰 종목 뉴스 크롤링")
news_keyword = st.sidebar.text_input("뉴스 검색 종목명", "")
c1, c2 = st.sidebar.columns(2)
with c1: news_start_date = st.date_input("시작일", datetime.now() - timedelta(days=7))
with c2: news_end_date = st.date_input("종료일", datetime.now())

if st.sidebar.button("최신 뉴스 가져오기"):
    st.session_state['news_keyword'] = news_keyword if news_keyword.strip() else ""
    st.session_state['news_start_date'] = news_start_date
    st.session_state['news_end_date'] = news_end_date
    st.session_state['news_searched'] = True

st.sidebar.markdown("---")
st.sidebar.header("🔍 검색 조건 설정")

with st.sidebar.form("search_form"):
    st.subheader("1단계: 기본 필터")
    min_price, max_price = st.slider("주가 범위 (원)", 1000, 500000, (5000, 200000), step=1000)
    min_amount_b = st.radio("최소 일평균 거래대금 (억원)", [1, 5, 10, 20], index=1, horizontal=True)
    min_marcap_b = st.number_input("최소 시가총액 (억원)", min_value=100, value=1000, step=100)
    exclude_preferred = st.checkbox("우선주 제외 (종목코드 끝자리 '0'만 포함)", value=True)
    exclude_etf_spac = st.checkbox("ETF / ETN / 스팩(SPAC) 제외", value=True)
    exclude_new_listing = st.checkbox("1년 미만 신규상장주 제외", value=True)
    
    st.subheader("2단계: 추세 확인")
    use_step2 = st.checkbox("2단계 전체 활성화 (추세 확인)", value=True)
    use_step2_1 = st.checkbox("이평선 정배열 (종가 > 20MA > 60MA)", value=True, disabled=not use_step2)
    use_step2_2 = st.checkbox("20일선 우상향", value=True, disabled=not use_step2)
    
    st.subheader("3단계: 눌림 발생")
    use_step3 = st.checkbox("3단계 전체 활성화 (고점대비 하락, 거래량 감소, 이평선 근접)", value=True)
    c1, c2 = st.columns(2)
    with c1: step3_decline_min = st.number_input("최소 하락률 (%)", value=5, step=1, disabled=not use_step3)
    with c2: step3_decline_max = st.number_input("최대 하락률 (%)", value=15, step=1, disabled=not use_step3)
    
    st.subheader("4단계: 반등 신호")
    use_step4 = st.checkbox("4단계 전체 활성화 (아래꼬리, 거래량 회복)", value=True)
    step4_vol_type = st.radio("거래량 회복 기준", ["전일 대비", "최근 평균 대비"], horizontal=True, disabled=not use_step4)
    c3, c4 = st.columns(2)
    if step4_vol_type == "전일 대비":
        with c3: step4_vol_ratio = st.number_input("전일 대비 최소 N배 이상", value=1.0, step=0.1, disabled=not use_step4)
        step4_vol_avg_days = 5 # unused
    else:
        with c3: step4_vol_avg_days = st.number_input("최근 N일 평균", value=5, step=1, disabled=not use_step4)
        with c4: step4_vol_ratio = st.number_input("평균 대비 최소 N배 이상", value=0.5, step=0.1, disabled=not use_step4)
    
    st.subheader("5단계: 제외 조건")
    use_step5 = st.checkbox("5단계 활성화 (최근 단기 급등 종목 제외)", value=True)
    st.markdown("**공시/실적 리스크는 네이버 금융 링크를 통해 직접 확인하세요.**")
    
    submitted = st.form_submit_button("🔍 조건 검색 실행", type="primary")

# --- Functions ---
import urllib.parse

def crawl_naver_news_search(keyword, start_date=None, end_date=None, status_placeholder=None, progress_bar=None):
    """네이버 금융 뉴스에서 기사를 크롤링하여 DB에 저장 (issue_map 방식)"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    db_keyword_label = keyword.strip() if keyword.strip() else "전체"
    
    if start_date and end_date:
        s_date = datetime.combine(start_date, datetime.min.time()) if not isinstance(start_date, datetime) else start_date
        e_date = datetime.combine(end_date, datetime.min.time()) if not isinstance(end_date, datetime) else end_date
    else:
        e_date = datetime.now()
        s_date = e_date - timedelta(days=7)
    
    # 기존에 수집된 URL 목록 로드 (중복 탐색 방지용)
    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT url FROM news WHERE keyword = :kw"), {"kw": db_keyword_label})
        existing_urls = {row[0] for row in result}
    
    total_days = (e_date - s_date).days + 1
    if total_days <= 0: total_days = 1
    
    all_news = []
    current_date = s_date
    delta = timedelta(days=1)
    day_count = 0
    
    while current_date <= e_date:
        date_param = current_date.strftime('%Y%m%d')
        date_str = current_date.strftime('%Y-%m-%d')
        page = 1
        empty_count = 0
        
        if status_placeholder:
            status_placeholder.info(f"크롤링 중... ({date_str} 탐색 시작 | 누적 {len(all_news)}건 발견)")
        
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
                page_count = 0
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
                            
                            # keyword 필터링: 키워드가 있으면 제목+요약에 포함된 기사만
                            if keyword.strip():
                                if keyword.strip() not in (title + ' ' + summary):
                                    continue
                            
                            all_news.append({
                                'title': title,
                                'url': link,
                                'source': press,
                                'published_date': wdate,
                                'summary': summary
                            })
                            page_count += 1
                        else:
                            i += 1
                
                total_items = sum(len(dl.select('.articleSubject')) for dl in valid_dls)
                
                # 현재 페이지의 모든 기사가 이미 DB에 있다면, 더 이상 과거 페이지를 탐색할 필요 없음 (시간순 정렬이므로)
                if total_items > 0 and existing_count_on_page == total_items:
                    if status_placeholder:
                        status_placeholder.info(f"크롤링 스킵 중... ({date_str} 이미 수집된 기사 도달)")
                    break
                    
                if total_items < 10:
                    break
                
                if status_placeholder:
                    status_placeholder.info(f"크롤링 중... ({date_str} 탐색 중 | 페이지 {page} | 누적 {len(all_news)}건 발견)")
                
                page += 1
                time.sleep(0.3)
                
            except Exception as e:
                break
        
        day_count += 1
        if progress_bar:
            progress = min(1.0, day_count / total_days)
            progress_bar.progress(progress)
            
        current_date += delta
        time.sleep(0.3)
    
    if status_placeholder:
        status_placeholder.info(f"DB 저장 중... (총 {len(all_news)}건 처리)")
    
    # DB 저장
    engine = get_db_engine()
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
    
    return all_news, saved_count

import streamlit.components.v1 as components

@st.cache_data(ttl=3600, show_spinner=False)
def fetch_article_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        res = requests.get(url, headers=headers, timeout=5)
        res.encoding = 'euc-kr'
        
        real_url = url
        # 네이버 금융 뉴스는 실제 기사(n.news.naver.com)로 JS 리다이렉트하는 경우가 많음
        match = re.search(r"href=['\"](https://n\.news\.naver\.com/.*?)['\"]", res.text)
        if match:
            real_url = match.group(1)
            res = requests.get(real_url, headers=headers, timeout=5)
            # n.news.naver.com은 보통 utf-8
            if 'charset=euc-kr' in res.headers.get('content-type', '').lower():
                res.encoding = 'euc-kr'
            else:
                res.encoding = 'utf-8'
        
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # n.news.naver.com 구조 (최신)
            title_tag = soup.select_one('#title_area')
            date_tag = soup.select_one('.media_end_head_info_datestamp_time')
            content_tag = soup.select_one('#dic_area')
            
            # 구형 네이버 금융 뉴스 구조 폴백
            if not title_tag: title_tag = soup.select_one('.article_info h3')
            if not date_tag: date_tag = soup.select_one('.article_info .article_date')
            if not content_tag: content_tag = soup.select_one('#news_read')
            
            title = title_tag.text.strip() if title_tag else "제목을 불러올 수 없습니다."
            date_str = date_tag.text.strip() if date_tag else ""
            content_html = str(content_tag) if content_tag else "<p>본문을 불러올 수 없거나 지원하지 않는 기사 형식입니다.</p>"
            
            # 불필요한 스크립트 태그 제거
            clean_soup = BeautifulSoup(content_html, 'html.parser')
            for script in clean_soup(["script", "style", "iframe", "button"]):
                script.decompose()
            
            clean_html = f"""
            <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; line-height: 1.7; padding: 20px; color: #e0e0e0; background: #1e1e1e; border-radius: 10px;">
                <h2 style="border-bottom: 2px solid #444; padding-bottom: 10px; color: #fff; font-size: 1.5em; margin-top: 0;">{title}</h2>
                <p style="color: #aaa; font-size: 0.9em; margin-bottom: 25px;">{date_str}</p>
                <div style="font-size: 1.1em; overflow-wrap: break-word; color: #ddd;">
                    {str(clean_soup)}
                </div>
            </div>
            """
            return clean_html
            
        return f"<h3>기사를 불러오지 못했습니다. (HTTP {res.status_code})</h3>"
    except Exception as e:
        return f"<h3>기사 로딩 중 오류가 발생했습니다: {str(e)}</h3>"

@st.cache_data(ttl=3600, show_spinner=False)
def get_krx_listing():
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    def get_market_data(sosok):
        result = []
        for page in range(1, 60):
            url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"
            res = requests.get(url, headers=headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            
            table = soup.find('table', {'class': 'type_2'})
            if not table: break
            
            rows = table.find_all('tr')
            added = 0
            for row in rows:
                cols = row.find_all('td')
                if len(cols) > 5:
                    a_tag = cols[1].find('a')
                    if not a_tag: continue
                    name = a_tag.text.strip()
                    code = a_tag['href'].split('code=')[-1]
                    close = cols[2].text.replace(',', '')
                    marcap = cols[6].text.replace(',', '')
                    
                    try:
                        result.append({
                            'Code': code,
                            'Name': name,
                            'Close': int(close),
                            'Marcap': int(marcap) * 100000000,
                            'Market': 'KOSPI' if sosok == 0 else 'KOSDAQ'
                        })
                        added += 1
                    except:
                        pass
            if added == 0:
                break
        return pd.DataFrame(result)
        
    df_kospi = get_market_data(0)
    df_kosdaq = get_market_data(1)
    df = pd.concat([df_kospi, df_kosdaq], ignore_index=True)
    return df

@st.cache_data(ttl=3600, show_spinner=False)
def fetch_history(code, start_date):
    try:
        df = fdr.DataReader(code, start_date)
        if df.empty:
            return code, None
        return code, df
    except Exception:
        return code, None

@st.cache_data(ttl=3600, show_spinner=False)
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

def analyze_stock(code, df, min_amount_b, exclude_new_listing, use_step2, use_step2_1, use_step2_2, use_step3, step3_decline_min, step3_decline_max, use_step4, step4_vol_type, step4_vol_ratio, step4_vol_avg_days, use_step5):
    if df is None or len(df) < 65:
        return False, None
        
    if exclude_new_listing and len(df) < 230:
        return False, None
    
    df = df.copy()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA60'] = df['Close'].rolling(window=60).mean()
    df['Amount'] = df['Close'] * df['Volume']
    
    recent = df.iloc[-1]
    
    avg_amount_20 = df['Amount'].tail(20).mean()
    if avg_amount_20 < min_amount_b * 100000000:
        return False, None
        
    highest_20 = df['High'].tail(20).max()
    if highest_20 == 0: return False, None

    if use_step2:
        if use_step2_1:
            if not (recent['Close'] > recent['MA20'] and recent['MA20'] > recent['MA60']):
                return False, None
        
        if use_step2_2:
            ma_target_last_5 = df['MA20'].tail(6).values
            is_rising = all(ma_target_last_5[i] <= ma_target_last_5[i+1] for i in range(5))
            if not is_rising:
                return False, None
            
    if use_step3:
        decline = (recent['Close'] - highest_20) / highest_20
        if not (-step3_decline_max / 100 <= decline <= -step3_decline_min / 100):
            return False, None
            
        avg_vol_3 = df['Volume'].tail(3).mean()
        avg_vol_prev_10 = df['Volume'].iloc[-13:-3].mean()
        if avg_vol_3 >= avg_vol_prev_10:
            return False, None
            
        ma_dist = (recent['Close'] - recent['MA20']) / recent['MA20']
        if not (-0.03 <= ma_dist <= 0.03):
            return False, None
            
    if use_step4:
        def has_lower_tail(row):
            hl_range = row['High'] - row['Low']
            if hl_range == 0: return False
            return (row['Close'] - row['Low']) / hl_range >= 0.5
            
        yesterday = df.iloc[-2]
        if not (has_lower_tail(recent) or has_lower_tail(yesterday)):
            return False, None
            
        if step4_vol_type == "전일 대비":
            if recent['Volume'] < df['Volume'].iloc[-2] * step4_vol_ratio:
                return False, None
        else:
            avg_vol = df['Volume'].tail(int(step4_vol_avg_days)).mean()
            if recent['Volume'] < avg_vol * step4_vol_ratio:
                return False, None
            
        if (recent['High'] - recent['Close']) / recent['High'] > 0.03:
            return False, None
            
    if use_step5:
        for i in range(1, 6):
            row = df.iloc[-i]
            prev_row = df.iloc[-i-1]
            if prev_row['Close'] == 0: continue
            if (row['Close'] - prev_row['Close']) / prev_row['Close'] >= 0.29:
                return False, None
                
    return True, df

# --- Main App ---
st.markdown("---")

if st.session_state.get('view_mode') == 'news':
    # 태그 관리 초기화
    if 'news_tags' not in st.session_state:
        st.session_state['news_tags'] = []
        
    def add_news_tag():
        new_tag = st.session_state.get('news_tag_input', '').strip()
        if new_tag and new_tag not in st.session_state['news_tags']:
            st.session_state['news_tags'].append(new_tag)
        st.session_state['news_tag_input'] = ""
        
    def remove_news_tag(tag_to_remove):
        if tag_to_remove in st.session_state['news_tags']:
            st.session_state['news_tags'].remove(tag_to_remove)

    header_col, filter_col = st.columns([2, 1])
    with header_col:
        st.header("📰 기사 리스트 및 임베디드 뷰어")
    with filter_col:
        st.write("") # padding
        st.text_input("종목/키워드 추가 (입력 후 Enter)", key="news_tag_input", on_change=add_news_tag, placeholder="예: 삼성전자", label_visibility="collapsed")
        
        # 추가된 태그(키워드) 렌더링
        tags = st.session_state['news_tags']
        if tags:
            # 태그들을 가로로 나열하기 위해 버튼 사용
            cols = st.columns(len(tags) + 1)
            for i, tag in enumerate(tags):
                with cols[i]:
                    if st.button(f"{tag} ✖", key=f"tag_btn_{tag}", help="클릭하여 제거"):
                        remove_news_tag(tag)
                        st.rerun()
    
    keyword = st.session_state.get('news_keyword', '')
    display_keyword = keyword.strip() if keyword.strip() else "전체"
    
    # 크롤링 버튼이 눌렸으면 먼저 크롤링 실행
    if st.session_state.get('news_searched'):
        start_d = st.session_state.get('news_start_date')
        end_d = st.session_state.get('news_end_date')
        
        st.info(f"네이버 금융 뉴스에서 '{display_keyword}' 관련 기사 크롤링 준비...")
        status_text = st.empty()
        p_bar = st.progress(0)
        
        news_items, saved_count = crawl_naver_news_search(keyword, start_d, end_d, status_placeholder=status_text, progress_bar=p_bar)
        
        status_text.empty()
        p_bar.empty()
        st.success(f"크롤링 완료! {len(news_items)}개 기사 발견, {saved_count}개 신규 DB 저장.")
        st.session_state['news_searched'] = False
    
    engine = get_db_engine()
    query_params = {}
    base_query = 'SELECT title, url, source, published_date, summary, is_read FROM news'
    where_clauses = []
    
    if keyword.strip():
        where_clauses.append("keyword = :kw")
        query_params['kw'] = display_keyword
        
    # 다중 태그(키워드) 필터링 (OR 조건)
    tags = st.session_state.get('news_tags', [])
    if tags:
        tag_clauses = []
        for i, tag in enumerate(tags):
            tag_clauses.append(f"(title LIKE :tag_{i} OR summary LIKE :tag_{i})")
            query_params[f'tag_{i}'] = f"%{tag}%"
        # OR로 묶고 전체는 AND로 연결
        where_clauses.append("(" + " OR ".join(tag_clauses) + ")")
        
    # 페이징 처리
    if 'news_page' not in st.session_state:
        st.session_state['news_page'] = 1
        
    page_size = 50
    
    # 전체 개수 구하기
    count_query = "SELECT COUNT(*) FROM news"
    if where_clauses:
        count_query += " WHERE " + " AND ".join(where_clauses)
    total_count_df = pd.read_sql_query(count_query, engine, params=query_params)
    total_count = int(total_count_df.iloc[0, 0])
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    # 현재 페이지 교정
    if st.session_state['news_page'] > total_pages:
        st.session_state['news_page'] = total_pages
    if st.session_state['news_page'] < 1:
        st.session_state['news_page'] = 1
        
    offset = (st.session_state['news_page'] - 1) * page_size
    base_query += f" ORDER BY published_date DESC, id DESC LIMIT {page_size} OFFSET {offset}"
    
    df_news = pd.read_sql_query(base_query, engine, params=query_params)
    
    col1, col2 = st.columns([1, 2])
    with col1:
        st.subheader(f"[{display_keyword}] 관련 최신 기사")
        # 유사 기사 묶어보기 토글
        group_similar = st.checkbox("🔗 유사 기사 묶어보기 (비슷한 내용의 기사를 하나로 묶습니다)", value=True)
        st.markdown("---")
        
        if df_news.empty:
            st.warning("아직 수집된 기사가 없습니다. 좌측 사이드바에서 기간을 설정한 후 '최신 뉴스 가져오기' 버튼을 눌러주세요.")
        else:
            if group_similar:
                import difflib
                clusters = []
                for idx, row in df_news.iterrows():
                    title = row['title']
                    found = False
                    for cluster in clusters:
                        sim = difflib.SequenceMatcher(None, title, cluster[0]['title']).ratio()
                        if sim > 0.55:  # 55% 이상 유사하면 같은 그룹
                            cluster.append(row)
                            found = True
                            break
                    if not found:
                        clusters.append([row])
                
                for i, cluster in enumerate(clusters):
                    main_row = cluster[0]
                    is_read_mark = "✔️ " if main_row.get('is_read') else "🆕 "
                    if len(cluster) > 1:
                        label = f"{is_read_mark}🔥 {main_row['title']} (외 비슷한 기사 {len(cluster)-1}건)\n({main_row['source']} 등 | {main_row['published_date']})"
                    else:
                        label = f"{is_read_mark}{main_row['title']}\n({main_row['source']} | {main_row['published_date']})"
                        
                    if st.button(label, key=f"btn_group_{i}_{st.session_state['news_page']}", use_container_width=True):
                        st.session_state['selected_article_url'] = main_row['url']
                        with get_db_engine().connect() as conn:
                            conn.execute(text("UPDATE news SET is_read = TRUE WHERE url = :u"), {'u': main_row['url']})
                            conn.commit()
                        st.rerun()
            else:
                for idx, row in df_news.iterrows():
                    is_read_mark = "✔️ " if row.get('is_read') else "🆕 "
                    label = f"{is_read_mark}{row['title']}\n({row['source']} | {row['published_date']})"
                    if st.button(label, key=f"btn_{idx}_{st.session_state['news_page']}", use_container_width=True):
                        st.session_state['selected_article_url'] = row['url']
                        with get_db_engine().connect() as conn:
                            conn.execute(text("UPDATE news SET is_read = TRUE WHERE url = :u"), {'u': row['url']})
                            conn.commit()
                        st.rerun()
                    
            # 페이지 컨트롤 (이전/다음 버튼)
            if total_pages > 1:
                st.markdown("---")
                pcol1, pcol2, pcol3 = st.columns([1, 1, 1])
                with pcol1:
                    if st.button("◀ 이전 페이지", disabled=(st.session_state['news_page'] <= 1), use_container_width=True):
                        st.session_state['news_page'] -= 1
                        st.rerun()
                with pcol2:
                    st.markdown(f"<div style='text-align: center; padding-top: 10px;'>{st.session_state['news_page']} / {total_pages}</div>", unsafe_allow_html=True)
                with pcol3:
                    if st.button("다음 페이지 ▶", disabled=(st.session_state['news_page'] >= total_pages), use_container_width=True):
                        st.session_state['news_page'] += 1
                        st.rerun()
                    
    with col2:
        st.subheader("기사 원문 뷰어")
        selected_url = st.session_state.get('selected_article_url')
        if selected_url:
            st.markdown(f"**원본 링크**: [{selected_url}]({selected_url})")
            with st.spinner("본문 내용을 불러오는 중입니다... (최초 1회만 약 1~2초 소요)"):
                html_content = fetch_article_html(selected_url)
                st.markdown(html_content, unsafe_allow_html=True)
        else:
            st.info("좌측 리스트에서 읽고 싶은 기사를 클릭해주세요.")

else:
    if st.session_state.get('news_searched'):
        keyword = st.session_state['news_keyword']
        start_d = st.session_state.get('news_start_date')
        end_d = st.session_state.get('news_end_date')
        
        display_keyword = keyword.strip() if keyword.strip() else "전체"
        st.subheader(f"📰 '{display_keyword}' 관련 뉴스 크롤링 결과")
        
        status_text = st.empty()
        p_bar = st.progress(0)
        
        news_items, saved_count = crawl_naver_news_search(keyword, start_d, end_d, status_placeholder=status_text, progress_bar=p_bar)
        
        status_text.empty()
        p_bar.empty()
        st.success(f"크롤링 완료! {len(news_items)}개 기사 발견, {saved_count}개 신규 DB 저장. '기사보기 모드'로 전환하여 확인하세요.")
        st.markdown("---")
        st.session_state['news_searched'] = False

if submitted:
    with st.spinner("KRX 종목 마스터 데이터를 불러오는 중..."):
        krx_df = get_krx_listing()
    
    with st.spinner("1단계: 기본 필터 적용 중..."):
        cond_price = (krx_df['Close'] >= min_price) & (krx_df['Close'] <= max_price)
        cond_marcap = (krx_df['Marcap'] >= min_marcap_b * 100000000)
        cond_market = krx_df['Market'].isin(['KOSPI', 'KOSDAQ', 'KOSPI200'])
        
        filtered_df = krx_df[cond_price & cond_marcap & cond_market]
        if exclude_preferred:
            filtered_df = filtered_df[filtered_df['Code'].str.endswith('0')]
            
        if exclude_etf_spac:
            # KB자산운용(KBSTAR -> RISE), 한화자산운용(ARIRANG -> PLUS) 등 최근 변경된 브랜드명 추가
            etf_etn_spac_pattern = r'^(KODEX|TIGER|KBSTAR|RISE|ARIRANG|PLUS|KOSEF|HANARO|ACE|SOL|TIMEFOLIO|TIME|히어로즈|마이티|TREX|파워|WOORI|KOACT|WON|KIWOOM|1Q|MIDAS|마이다스|에셋플러스|네비게이터|HK|BNK|VITA|KINDEX|대신343|UNTACT|UNICORN)|ETN|스팩|제\d+호'
            filtered_df = filtered_df[~filtered_df['Name'].str.contains(etf_etn_spac_pattern, case=False, regex=True)]
            
        codes = filtered_df['Code'].tolist()
        
    st.info(f"1단계 기본 조건(가격, 시총) 통과 종목: {len(codes)}개. 이제 상세 차트 데이터를 분석합니다...")
    
    if len(codes) > 0:
        # Fetch 10 years of data to support weekly/monthly/yearly charts
        start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
        
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        results = []
        chart_data_dict = {}
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_code = {executor.submit(fetch_history, code, start_date): code for code in codes}
            completed = 0
            
            for future in concurrent.futures.as_completed(future_to_code):
                code = future_to_code[future]
                completed += 1
                
                if completed % 10 == 0 or completed == len(codes):
                    progress_bar.progress(completed / len(codes))
                    status_text.text(f"데이터 다운로드 및 분석 중... ({completed}/{len(codes)})")
                
                res_code, hist_df = future.result()
                
                if hist_df is not None:
                    passed, analyzed_df = analyze_stock(res_code, hist_df, min_amount_b, exclude_new_listing, use_step2, use_step2_1, use_step2_2, use_step3, step3_decline_min, step3_decline_max, use_step4, step4_vol_type, step4_vol_ratio, step4_vol_avg_days, use_step5)
                    if passed:
                        row = filtered_df[filtered_df['Code'] == res_code].iloc[0]
                        avg_amt_20 = int(analyzed_df['Amount'].tail(20).mean() / 100000000)
                        results.append({
                            "종목코드": res_code,
                            "종목명": row['Name'],
                            "현재가": row['Close'],
                            "시가총액(억)": int(row['Marcap'] / 100000000),
                            "20일 평균거래대금(억)": avg_amt_20,
                            "시장": row['Market']
                        })
                        chart_data_dict[res_code] = analyzed_df
                        
        status_text.empty()
        progress_bar.empty()
        
        if len(results) > 0:
            st.success(f"🎉 모든 조건을 만족하는 종목 {len(results)}개를 찾았습니다!")
            res_df = pd.DataFrame(results)
            res_df['네이버 금융'] = res_df['종목코드'].apply(lambda x: f"https://finance.naver.com/item/main.naver?code={x}")
            
            st.session_state['res_df'] = res_df
            st.session_state['chart_data_dict'] = chart_data_dict
        else:
            st.warning("조건을 만족하는 종목이 없습니다. 조건을 조금 완화해 보세요.")
            if 'res_df' in st.session_state:
                del st.session_state['res_df']
            if 'chart_data_dict' in st.session_state:
                del st.session_state['chart_data_dict']

if 'res_df' in st.session_state and 'chart_data_dict' in st.session_state:
    res_df = st.session_state['res_df']
    chart_data_dict = st.session_state['chart_data_dict']
    
    st.dataframe(
        res_df,
        column_config={
            "네이버 금융": st.column_config.LinkColumn("공시/실적 확인 (클릭)")
        },
        hide_index=True,
        use_container_width=True
    )
else:
    res_df = pd.DataFrame()
    chart_data_dict = {}
    
st.markdown("---")
st.subheader("📊 차트 확인")

if len(res_df) > 0:
    chart_source = st.radio("차트 종목 선택 방식", ["조건 검색 결과에서 선택", "전체 종목에서 직접 검색"], horizontal=True)
else:
    chart_source = "전체 종목에서 직접 검색"

df_krx = get_krx_listing()

col1, col2, col3 = st.columns([1.5, 2, 1.5])
with col1:
    if chart_source == "조건 검색 결과에서 선택":
        selected_name = st.selectbox("검색된 종목 중 선택", res_df['종목명'].tolist())
    else:
        selected_name = st.selectbox("전체 종목 검색 (이름을 입력하세요)", df_krx['Name'].tolist())
with col2:
    timeframe = st.radio("캔들 주기", ["일봉", "주봉", "월봉", "30분봉"], horizontal=True)
with col3:
    if timeframe == "30분봉":
        period_options = ["1달", "1주일", "1일"]
    elif timeframe == "일봉":
        period_options = ["10년 (전체)", "5년", "1년", "6개월", "1달", "1주일", "1일"]
    elif timeframe == "주봉":
        period_options = ["10년 (전체)", "5년", "1년", "6개월", "1달"]
    elif timeframe == "월봉":
        period_options = ["10년 (전체)", "5년", "1년", "6개월"]
        
    prev_period = st.session_state.get('prev_view_period', "1년")
    if prev_period in period_options:
        default_idx = period_options.index(prev_period)
    else:
        default_idx = len(period_options) - 1
        
    view_period = st.selectbox("조회 기간", period_options, index=default_idx)
    st.session_state['prev_view_period'] = view_period
    
col4, col5, col6 = st.columns([1, 1.5, 1])
with col4:
    chart_type = st.radio("차트 형태", ["캔들 차트", "선(Line) 차트"], horizontal=True)
with col5:
    st.markdown("<div style='margin-bottom: -15px;'><small>이동평균선 표시</small></div>", unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1: show_ma5 = st.checkbox("🩷 5선(분홍)", value=False)
    with c2: show_ma10 = st.checkbox("🟣 10선(보라)", value=False)
    with c3: show_ma20 = st.checkbox("🟠 20선(주황)", value=True)
    
    c4, c5, c6 = st.columns(3)
    with c4: show_ma60 = st.checkbox("🟢 60선(초록)", value=True)
    with c5: show_ma120 = st.checkbox("🔵 120선(하늘)", value=False)
    with c6: show_ma200 = st.checkbox("🔴 200선(빨강)", value=False)
with col6:
    st.write("")
    show_vp = st.checkbox("매물대(Volume Profile) 표시", value=False)
    show_rsi = st.checkbox("RSI (14) 보조지표 표시", value=False)
    show_bb = st.checkbox("볼린저밴드 (20, 2) 표시", value=False)
    show_slider = st.checkbox("하단 X축 슬라이더 표시", value=False)

if selected_name:
    sel_code = df_krx[df_krx['Name'] == selected_name].iloc[0]['Code']
    sel_market = df_krx[df_krx['Name'] == selected_name].iloc[0]['Market']
    
    if timeframe == "30분봉":
        with st.spinner("30분봉 데이터를 가져오는 중..."):
            df_plot = fetch_minute_data(sel_code, sel_market, interval="30m", period="60d")
    else:
        if sel_code in chart_data_dict:
            df_plot = chart_data_dict[sel_code].copy()
        else:
            with st.spinner("차트 데이터를 가져오는 중..."):
                start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
                _, fetched_df = fetch_history(sel_code, start_date)
                if fetched_df is not None and not fetched_df.empty:
                    df_plot = fetched_df.copy()
                    df_plot['Amount'] = df_plot['Close'] * df_plot['Volume']
                else:
                    st.error("데이터를 불러올 수 없습니다.")
                    st.stop()
                    
        if timeframe != "일봉":
            resample_dict = {
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum',
                'Amount': 'sum'
            }
            
            if timeframe == "주봉":
                rule = 'W'
            elif timeframe == "월봉":
                rule = 'ME'
                
            df_plot = df_plot.resample(rule).agg(resample_dict).dropna()
        
    df_plot['MA5'] = df_plot['Close'].rolling(window=5).mean()
    df_plot['MA10'] = df_plot['Close'].rolling(window=10).mean()
    df_plot['MA20'] = df_plot['Close'].rolling(window=20).mean()
    df_plot['MA60'] = df_plot['Close'].rolling(window=60).mean()
    df_plot['MA120'] = df_plot['Close'].rolling(window=120).mean()
    df_plot['MA200'] = df_plot['Close'].rolling(window=200).mean()
    
    if show_rsi:
        delta = df_plot['Close'].diff()
        up = delta.clip(lower=0)
        down = -1 * delta.clip(upper=0)
        ema_up = up.ewm(com=13, adjust=False).mean()
        ema_down = down.ewm(com=13, adjust=False).mean()
        rs = ema_up / ema_down
        df_plot['RSI'] = 100 - (100 / (1 + rs))
        
    if show_bb:
        df_plot['std20'] = df_plot['Close'].rolling(window=20).std()
        df_plot['BB_up'] = df_plot['MA20'] + 2 * df_plot['std20']
        df_plot['BB_down'] = df_plot['MA20'] - 2 * df_plot['std20']
        
    if view_period != "10년 (전체)":
        end_date = df_plot.index.max()
        if view_period == "5년":
            start_dt = end_date - timedelta(days=365*5)
        elif view_period == "1년":
            start_dt = end_date - timedelta(days=365)
        elif view_period == "6개월":
            start_dt = end_date - timedelta(days=180)
        elif view_period == "1달":
            start_dt = end_date - timedelta(days=30)
        elif view_period == "1주일":
            start_dt = end_date - timedelta(days=7)
        elif view_period == "1일":
            if timeframe == "30분봉":
                start_dt = end_date.replace(hour=9, minute=0, second=0, microsecond=0)
            else:
                start_dt = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
        df_plot = df_plot[df_plot.index >= start_dt]
    
    num_rows = 3 if show_rsi else 2
    row_widths = [0.15, 0.2, 0.6] if show_rsi else [0.2, 0.7]
    subplot_titles = [f"{selected_name} ({sel_code}) {timeframe}", '거래대금 (억원)']
    if show_rsi:
        subplot_titles.append('RSI (14)')
        
    fig = make_subplots(rows=num_rows, cols=1, shared_xaxes=True, 
                        vertical_spacing=0.03, subplot_titles=subplot_titles, 
                        row_width=row_widths)
    
    if chart_type == "캔들 차트":
        fig.add_trace(go.Candlestick(x=df_plot.index,
                        open=df_plot['Open'],
                        high=df_plot['High'],
                        low=df_plot['Low'],
                        close=df_plot['Close'],
                        increasing_line_color='red',
                        decreasing_line_color='blue',
                        name='캔들'), row=1, col=1)
    else:
        fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['Close'], mode='lines', name='종가선', line=dict(color='cyan', width=2)), row=1, col=1)
                    
    if show_ma5: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA5'], mode='lines', name='5선', line=dict(color='pink', width=2)), row=1, col=1)
    if show_ma10: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA10'], mode='lines', name='10선', line=dict(color='purple', width=2)), row=1, col=1)
    if show_ma20: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA20'], mode='lines', name='20선', line=dict(color='orange', width=2)), row=1, col=1)
    if show_ma60: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA60'], mode='lines', name='60선', line=dict(color='green', width=2)), row=1, col=1)
    if show_ma120: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA120'], mode='lines', name='120선', line=dict(color='lightblue', width=2)), row=1, col=1)
    if show_ma200: fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['MA200'], mode='lines', name='200선', line=dict(color='red', width=2)), row=1, col=1)
    
    if show_bb:
        fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['BB_up'], mode='lines', name='BB 상단', line=dict(color='rgba(200, 200, 255, 0.6)', width=1.5, dash='dot')), row=1, col=1)
        fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['BB_down'], mode='lines', name='BB 하단', fill='tonexty', fillcolor='rgba(200, 200, 255, 0.1)', line=dict(color='rgba(200, 200, 255, 0.6)', width=1.5, dash='dot')), row=1, col=1)
        
    if show_vp:
        df_vp = df_plot.dropna(subset=['Close', 'Volume']).copy()
        if len(df_vp) > 1:
            min_p = df_vp['Low'].min()
            max_p = df_vp['High'].max()
            if max_p > min_p:
                bins = np.linspace(min_p, max_p, 40)
            else:
                bins = 40
            
            df_vp['bin'] = pd.cut(df_vp['Close'], bins=bins, include_lowest=True)
            vp = df_vp.groupby('bin', observed=False)['Volume'].sum()
            
            fig.add_trace(go.Bar(
                y=[b.mid for b in vp.index],
                x=vp.values,
                orientation='h',
                name='매물대',
                marker_color='rgba(150, 150, 150, 0.4)',
                xaxis='x9',
                yaxis='y1'
            ))
    
    amount_100m = df_plot['Amount'] / 100000000
    colors = ['red' if close >= open else 'blue' for close, open in zip(df_plot['Close'], df_plot['Open'])]
    fig.add_trace(go.Bar(x=df_plot.index, y=amount_100m, name='거래대금', marker_color=colors), row=2, col=1)
    
    amount_ma20 = amount_100m.rolling(window=20).mean()
    fig.add_trace(go.Scatter(x=df_plot.index, y=amount_ma20, mode='lines', name='거래대금 20평균', line=dict(color='yellow', width=2)), row=2, col=1)
    
    if show_rsi:
        fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['RSI'], mode='lines', name='RSI', line=dict(color='yellow', width=1.5)), row=3, col=1)
        fig.add_hline(y=70, line_dash="dash", line_color="red", row=3, col=1, opacity=0.5)
        fig.add_hline(y=30, line_dash="dash", line_color="blue", row=3, col=1, opacity=0.5)
        # RSI y축 고정
        fig.update_yaxes(range=[0, 100], row=3, col=1)
    
    min_date_pad = df_plot.index.min() - timedelta(days=1)
    max_date_pad = df_plot.index.max() + timedelta(days=1)
    
    def add_shaded_rect(x0, x1):
        if x0 > max_date_pad or x1 < min_date_pad: return
        x0_c = max(min_date_pad, x0)
        x1_c = min(max_date_pad, x1)
        fig.add_vrect(x0=x0_c, x1=x1_c, fillcolor="white", opacity=0.05, layer="below", line_width=0)
        
    if view_period == "1주일":
        unique_dates = df_plot.index.normalize().unique()
        for i, d in enumerate(unique_dates):
            if i % 2 == 0:
                if timeframe == "30분봉":
                    add_shaded_rect(d.replace(hour=9), d.replace(hour=15, minute=30))
                else:
                    add_shaded_rect(d, d + timedelta(days=1))
    elif view_period == "1달":
        unique_weeks = df_plot.index.to_period('W').unique()
        for i, w in enumerate(unique_weeks):
            if i % 2 == 0:
                add_shaded_rect(w.start_time, w.end_time)
    else:
        unique_months = df_plot.index.to_period('M').unique()
        for i, m in enumerate(unique_months):
            if i % 2 == 0:
                add_shaded_rect(m.start_time, m.end_time)
    
    fig.update_layout(
        title=f"{selected_name} ({sel_code}) 분석 차트",
        yaxis_title='주가 (원)',
        yaxis=dict(tickformat=","),
        yaxis2_title='거래대금(억)',
        xaxis2_title='날짜',
        xaxis_rangeslider_visible=show_slider,
        height=800 if not show_rsi else 1000,
        template='plotly_dark',
        showlegend=False
    )
    
    rangebreaks_list = [dict(bounds=["sat", "mon"])]
    if timeframe == "30분봉":
        rangebreaks_list.append(dict(bounds=[15.5, 9], pattern="hour"))
    
    if timeframe == "30분봉":
        x_format = "%y.%m.%d %H:%M"
    elif timeframe == "월봉":
        x_format = "%Y.%m"
    else:
        x_format = "%y.%m.%d"
        
    fig.update_xaxes(
        tickformat=x_format,
        hoverformat="%y.%m.%d %H:%M" if timeframe == "30분봉" else "%y.%m.%d",
        rangebreaks=rangebreaks_list
    )
    
    if show_vp and 'vp' in locals():
        fig.update_layout(
            xaxis9=dict(
                overlaying='x1',
                side='top',
                showticklabels=False,
                showgrid=False,
                range=[0, vp.values.max() * 4]
            )
        )
    
    st.plotly_chart(fig, use_container_width=True, config={'scrollZoom': True})
