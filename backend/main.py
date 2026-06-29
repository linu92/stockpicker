from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from database import get_db_engine, init_db
from services import get_krx_listing, fetch_history, analyze_stock, crawl_naver_news_search, fetch_article_html, fetch_minute_data, fetch_index
from models import SearchRequest
from datetime import datetime, timedelta
import concurrent.futures
import pandas as pd
from sqlalchemy import text

app = FastAPI(title="StockPicker API")

@app.on_event("startup")
def on_startup():
    init_db()

# 프론트엔드 연동을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 개발 환경
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to StockPicker API"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/market/listings")
def market_listings():
    df = get_krx_listing()
    return {"data": df.to_dict(orient="records")}

from fastapi.responses import StreamingResponse
import json

@app.post("/api/search")
def search_stocks(req: SearchRequest):
    def generate():
        yield json.dumps({"type": "status", "message": "종목 리스트를 불러오는 중입니다..."}) + "\n"
        
        krx_df = get_krx_listing()
        
        cond_price = (krx_df['Close'] >= req.min_price) & (krx_df['Close'] <= req.max_price)
        cond_marcap = (krx_df['Marcap'] >= req.min_marcap_b * 100000000)
        cond_market = krx_df['Market'].isin(['KOSPI', 'KOSDAQ', 'KOSPI200'])
        
        filtered_df = krx_df[cond_price & cond_marcap & cond_market]
        if req.exclude_preferred:
            filtered_df = filtered_df[filtered_df['Code'].str.endswith('0')]
            
        if req.exclude_etf_spac:
            etf_etn_spac_pattern = r'^(KODEX|TIGER|KBSTAR|RISE|ARIRANG|PLUS|KOSEF|HANARO|ACE|SOL|TIMEFOLIO|TIME|히어로즈|마이티|TREX|파워|WOORI|KOACT|WON|KIWOOM|1Q|MIDAS|마이다스|에셋플러스|네비게이터|HK|BNK|VITA|KINDEX|대신343|UNTACT|UNICORN)|ETN|스팩|제\d+호'
            filtered_df = filtered_df[~filtered_df['Name'].str.contains(etf_etn_spac_pattern, case=False, regex=True)]
            
        codes = filtered_df['Code'].tolist()
        
        if not codes:
            yield json.dumps({"type": "progress", "current": 0, "total": 0}) + "\n"
            return
        required_trading_days = 20  # 기본 거래대금 20일 평균용
        
        if req.exclude_new_listing:
            required_trading_days = max(required_trading_days, 230)
            
        if req.use_step2:
            required_trading_days = max(required_trading_days, req.step2_ma_long)
            
        if req.rising_ma50:
            required_trading_days = max(required_trading_days, 50)
            
        if req.use_step4:
            required_trading_days = max(required_trading_days, req.step4_vol_avg_days + 1)
            
        # 영업일 -> 달력일 환산 (넉넉하게 1.5배 + 10일 버퍼)
        calendar_days_to_fetch = int(required_trading_days * 1.5) + 10
        start_date = ((datetime.utcnow() + timedelta(hours=9)) - timedelta(days=calendar_days_to_fetch)).strftime("%Y-%m-%d")
        
        total = len(codes)
        step_counts = {1: total, 2: 0, 3: 0, 4: 0, 5: 0}
        yield json.dumps({"type": "progress", "current": 0, "total": total, "step_counts": step_counts}) + "\n"
        
        count = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_code = {executor.submit(fetch_history, code, start_date): code for code in codes}
            for future in concurrent.futures.as_completed(future_to_code):
                count += 1
                res_code, hist_df = future.result()
                if hist_df is not None:
                    step_reached, analyzed_df = analyze_stock(
                        res_code, hist_df, req.min_amount_b, req.exclude_new_listing,
                        req.use_step2, req.use_step2_1, req.use_step2_2, req.use_step3,
                        req.step3_decline_min, req.step3_decline_max, req.use_step4,
                        req.step4_vol_type, req.step4_vol_ratio, req.step4_vol_avg_days,
                        req.use_step5, req.step2_ma_short, req.step2_ma_long,
                        req.rising_ma10, req.rising_ma20, req.rising_ma50
                    )
                    
                    for s in range(2, step_reached + 1):
                        step_counts[s] += 1
                        
                    yield json.dumps({"type": "progress", "current": count, "total": total, "step_counts": step_counts}) + "\n"
                    
                    if step_reached == 5:
                        row = filtered_df[filtered_df['Code'] == res_code].iloc[0]
                        avg_amt_20 = int(analyzed_df['Amount'].tail(20).mean() / 100000000)
                        
                        result_item = {
                            "종목코드": res_code,
                            "종목명": str(row['Name']),
                            "현재가": int(row['Close']),
                            "시가총액(억)": int(row['Marcap'] / 100000000),
                            "20일 평균거래대금(억)": avg_amt_20,
                            "시장": str(row['Market'])
                        }
                        yield json.dumps({"type": "result", "data": result_item}, ensure_ascii=False) + "\n"
    
    return StreamingResponse(generate(), media_type="application/x-ndjson")

@app.get("/api/chart/{code}")
def get_chart_data(
    code: str, 
    timeframe: str = Query("일봉"), 
    period: str = Query("3달"), 
    chart_offset: int = Query(0), 
    market: str = Query("KOSPI"),
    show_kospi: bool = Query(False),
    show_kosdaq: bool = Query(False)
):
    if timeframe == "30분봉":
        df = fetch_minute_data(code, market, interval="30m", period="60d")
    else:
        start_date = ((datetime.utcnow() + timedelta(hours=9)) - timedelta(days=3650)).strftime("%Y-%m-%d")
        _, df = fetch_history(code, start_date)
        if df is not None and not df.empty:
            df['Amount'] = df['Close'] * df['Volume']
            if timeframe != "일봉":
                resample_dict = {
                    'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum', 'Amount': 'sum'
                }
                rule = 'W' if timeframe == "주봉" else 'ME'
                df = df.resample(rule).agg(resample_dict).dropna()

    if df is None or df.empty:
        return {"data": [], "kospi": [], "kosdaq": []}
        
    df['MA5'] = df['Close'].rolling(window=5).mean()
    df['MA10'] = df['Close'].rolling(window=10).mean()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA60'] = df['Close'].rolling(window=60).mean()
    df['MA120'] = df['Close'].rolling(window=120).mean()
    df['MA200'] = df['Close'].rolling(window=200).mean()
    
    df['std20'] = df['Close'].rolling(window=20).std()
    df['BB_up'] = df['MA20'] + 2 * df['std20']
    df['BB_down'] = df['MA20'] - 2 * df['std20']
    
    delta = df['Close'].diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    ema_up = up.ewm(com=13, adjust=False).mean()
    ema_down = down.ewm(com=13, adjust=False).mean()
    rs = ema_up / ema_down
    df['RSI'] = 100 - (100 / (1 + rs))
    
    max_date_available = df.index.max()
    if period == "5년": td = timedelta(days=365*5)
    elif period == "1년": td = timedelta(days=365)
    elif period == "6개월": td = timedelta(days=180)
    elif period == "3달": td = timedelta(days=90)
    elif period == "1달": td = timedelta(days=30)
    elif period == "1주일": td = timedelta(days=7)
    elif period == "1일": td = timedelta(days=1)
    else: td = timedelta(days=3650)
        
    end_date = max_date_available - (td * chart_offset)
    
    if period == "1일":
        if timeframe == "30분봉":
            start_dt = end_date.replace(hour=9, minute=0, second=0, microsecond=0)
        else:
            start_dt = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_dt = end_date - td
        
    if start_dt < df.index.min(): start_dt = df.index.min()
    if end_date < start_dt: end_date = start_dt
        
    df = df[(df.index >= start_dt) & (df.index <= end_date)]
    
    kospi_data = []
    kosdaq_data = []
    
    if show_kospi:
        idx_df = fetch_index('KS11')
        if idx_df is not None and not idx_df.empty:
            idx_df = idx_df[(idx_df.index >= start_dt) & (idx_df.index <= end_date)]
            if not idx_df.empty:
                base_val = idx_df['KS11'].iloc[0]
                idx_df['Pct'] = (idx_df['KS11'] - base_val) / base_val * 100
                kospi_data = idx_df.reset_index().rename(columns={'index':'Date', 'Datetime':'Date'}).to_dict(orient="records")
                for item in kospi_data:
                    item['Date'] = item['Date'].strftime('%Y-%m-%d')
                    
    if show_kosdaq:
        idx_df = fetch_index('KQ11')
        if idx_df is not None and not idx_df.empty:
            idx_df = idx_df[(idx_df.index >= start_dt) & (idx_df.index <= end_date)]
            if not idx_df.empty:
                base_val = idx_df['KQ11'].iloc[0]
                idx_df['Pct'] = (idx_df['KQ11'] - base_val) / base_val * 100
                kosdaq_data = idx_df.reset_index().rename(columns={'index':'Date', 'Datetime':'Date'}).to_dict(orient="records")
                for item in kosdaq_data:
                    item['Date'] = item['Date'].strftime('%Y-%m-%d')
    
    df = df.reset_index()
    if 'Datetime' in df.columns:
        df.rename(columns={'Datetime': 'Date'}, inplace=True)
    if 'index' in df.columns:
        df.rename(columns={'index': 'Date'}, inplace=True)
        
    if 'Date' in df.columns:
        if timeframe == "30분봉":
            df['Date'] = df['Date'].dt.strftime('%Y-%m-%d %H:%M')
        else:
            df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
            
    # Calculate base price for stock to overlay with Kospi/Kosdaq percent if needed, but frontend can do it.
    
    return {
        "data": df.fillna("").to_dict(orient="records"),
        "kospi": kospi_data,
        "kosdaq": kosdaq_data
    }

# ==========================================
# NEWS API
# ==========================================
@app.get("/api/news")
def get_news(keyword: str = "전체"):
    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, title, url, source, published_date, summary, is_read FROM news WHERE keyword = :kw ORDER BY published_date DESC, id ASC LIMIT 200"), {"kw": keyword})
        data = [dict(row._mapping) for row in result]
    return {"data": data}

class CrawlRequest(BaseModel):
    keyword: str
    
@app.post("/api/news/crawl")
def trigger_crawl(req: CrawlRequest):
    def generate():
        yield from crawl_naver_news_search(req.keyword, stream=True)
    return StreamingResponse(generate(), media_type="application/x-ndjson")

@app.get("/api/news/content")
def get_news_content(url: str):
    html = fetch_article_html(url)
    engine = get_db_engine()
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE news SET is_read = TRUE WHERE url = :url"), {"url": url})
            conn.commit()
    except:
        pass
    return {"html": html}

# ==========================================
# WATCHLIST API
# ==========================================
@app.get("/api/watchlist")
def get_watchlist():
    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT stock_code, stock_name, added_at, buy_price, sell_price, youtube_link, added_price FROM watchlist ORDER BY added_at DESC"))
        data = [dict(row._mapping) for row in result]
    return {"data": data}

class WatchlistItem(BaseModel):
    stock_code: str
    stock_name: str
    buy_price: Optional[int] = None
    sell_price: Optional[int] = None
    youtube_link: Optional[str] = None
    added_price: Optional[int] = None

@app.post("/api/watchlist")
def add_watchlist(item: WatchlistItem):
    engine = get_db_engine()
    try:
        with engine.connect() as conn:
            from .database import is_postgres
            if is_postgres():
                conn.execute(text('''
                    INSERT INTO watchlist (stock_code, stock_name, buy_price, sell_price, youtube_link, added_price) 
                    VALUES (:code, :name, :buy, :sell, :link, :price)
                    ON CONFLICT (stock_code) DO UPDATE SET 
                        buy_price = EXCLUDED.buy_price, 
                        sell_price = EXCLUDED.sell_price, 
                        youtube_link = EXCLUDED.youtube_link
                '''), {
                    "code": item.stock_code, "name": item.stock_name, 
                    "buy": item.buy_price, "sell": item.sell_price, 
                    "link": item.youtube_link, "price": item.added_price
                })
            else:
                conn.execute(text('''
                    INSERT INTO watchlist (stock_code, stock_name, buy_price, sell_price, youtube_link, added_price) 
                    VALUES (:code, :name, :buy, :sell, :link, :price)
                    ON CONFLICT(stock_code) DO UPDATE SET 
                        buy_price=excluded.buy_price, 
                        sell_price=excluded.sell_price, 
                        youtube_link=excluded.youtube_link
                '''), {
                    "code": item.stock_code, "name": item.stock_name, 
                    "buy": item.buy_price, "sell": item.sell_price, 
                    "link": item.youtube_link, "price": item.added_price
                })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/api/watchlist/{code}")
def remove_watchlist(code: str):
    engine = get_db_engine()
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM watchlist WHERE stock_code = :code"), {"code": code})
        conn.commit()
    return {"status": "success"}
