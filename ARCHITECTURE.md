# StockPicker Architecture & Structure

This document outlines the core architecture, features, and structure of the `StockPicker` application. Review this document to quickly understand the codebase without needing to read through the entire `app.py`.

## 1. Core Technology Stack
- **Framework**: Streamlit
- **Data Processing**: Pandas, FinanceDataReader (FDR), pykrx
- **Charting**: Plotly (plotly.graph_objects)
- **Database**: SQLAlchemy (SQLite for local development, PostgreSQL on Supabase for production)
- **Web Scraping**: BeautifulSoup4, requests

## 2. File Structure
- `app.py`: The single main application file containing all UI logic, data fetching, and chart rendering.
- `requirements.txt`: Python dependencies.
- `.streamlit/secrets.toml`: Contains database credentials (e.g., Supabase PostgreSQL URL).

## 3. Database Schema
The database engine is initialized via `get_db_engine()`. The `init_db()` function creates the necessary tables if they do not exist.

### `news` table
Stores scraped news articles.
- `id`: Primary Key
- `title`: Article title
- `url`: Article URL (Unique)
- `source`: News publisher (e.g., 아시아경제)
- `published_date`: Publication date (Format: `YYYY-MM-DD`)
- `summary`: Short summary of the article
- `keyword`: The keyword used to scrape the article (e.g., "삼성전자" or "전체")
- `is_read`: Boolean indicating if the user has clicked/read the article (Default: False)

### `search_presets` table
Stores user's custom filter settings from the sidebar.
- `id`: Primary Key
- `name`: Name of the preset (Unique)
- `settings`: JSON string containing form values (e.g., `min_price`, `use_step2`, etc.)

### `watchlist` table
Stores the user's favorite stocks for quick tracking.
- `stock_code`: Primary Key (e.g., '005930')
- `stock_name`: Stock Name (e.g., '삼성전자')
- `added_at`: Timestamp of when the stock was favorited

## 4. Main Application Modes

The application uses `st.session_state['view_mode']` to toggle between two primary views via sidebar buttons:

### 4.1 조건 검색 및 차트 모드 (`view_mode == 'search'`)
This is the core stock analysis screen.

**Sidebar (Search Filters)**:
- Filter conditions are divided into 5 steps (Basic, Trend, Pullback, Rebound, Exclusions).
- **Preset System**: Loads settings from `search_presets` DB. When "조건 검색 실행" is clicked, settings are saved to `st.session_state`.
- **Multiprocessing**: `analyze_stock()` runs in parallel (`ThreadPoolExecutor` or `ProcessPoolExecutor`) to filter stocks fast.

**Main Screen (Chart & Results)**:
- Displays filtered stock list.
- **Recent Stocks**: Tracks the last 5 viewed stocks in `st.session_state['recent_stocks']` and displays them as quick-access buttons.
- **Charting Engine**: `draw_stock_chart()` uses Plotly to render Candlesticks, Moving Averages (MAs), Volume Profile (VP), RSI, and Bollinger Bands.
- Y-axis zooming is disabled (`fixedrange=True`) to maintain vertical scaling while dragging on the X-axis.

### 4.2 뉴스 수집 및 뷰어 모드 (`view_mode == 'news'`)
A dedicated dashboard for reading relevant news articles.

**Left Pane (Article List)**:
- **Crawler**: Fetches articles from Naver News based on keyword and date range (`crawl_naver_news_search()`).
- **Filters**: UI checkboxes to show "Unread only" and "Date filtering" (오늘, 어제, 최근 3일, etc.).
- **Caching**: `_query_news` caches database queries (TTL 30s) to prevent DB bottleneck when rerunning Streamlit after clicking an article.
- **Grouping**: Groups similar articles based on Title text similarity (`difflib.SequenceMatcher` > 55%).
- **Read State**: Clicking an article runs a background thread (`threading.Thread`) to execute an `UPDATE` query setting `is_read = TRUE` in the DB.

**Right Pane (Article Viewer)**:
- Embeds the full article HTML fetched directly from Naver via `fetch_article_html()`.
- **Caching**: `@st.cache_data(ttl=3600)` prevents redundant network requests when clicking the same article repeatedly.
- Strips out ads, scripts, and navigation elements from Naver's HTML to display a clean reader view.

### 4.3 관심 종목 모드 (`view_mode == 'watchlist'`)
A dedicated dashboard for tracking favorited stocks.
- **Display**: Shows a clean table of all watchlisted stocks containing current price, fluctuation rate, and volume.
- **Integration**: Fetches current prices dynamically via `pykrx`.
- **Actions**: Users can easily jump to the Chart (`view_mode == 'search'`) or delete a stock from the watchlist.

## 5. Important Session States (`st.session_state`)
- `view_mode`: Current active screen ('search' or 'news')
- `recent_stocks`: List of up to 5 recently viewed ticker symbols
- `target_stock`: Tracks the currently selected stock for the chart view
- `news_page`: Current page number for the news list pagination
- `selected_article_url`: The URL of the currently viewed article on the right pane

## 6. Development Rules & Notes
- **UI Responsiveness**: Streamlit reruns the whole script top-to-bottom on any interaction. Cache expensive DB queries and Web scraping wherever possible.
- **Date Filtering**: Note that `published_date` in the DB uses `YYYY-MM-DD` (e.g., `2026-06-26`), while Naver sometimes displays `YYYY.MM.DD.`. Always query using `YYYY-MM-DD`.
