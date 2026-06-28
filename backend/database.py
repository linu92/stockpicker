import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv() # Load .env file from the root directory

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'news.db') if '__file__' in dir() else 'news.db'

def get_db_engine():
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_URL")
    if db_url:
        return create_engine(db_url)
    else:
        return create_engine(f'sqlite:///{DB_PATH}')

def is_postgres():
    return bool(os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_URL"))

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
                conn.execute(text("ALTER TABLE news ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE"))
                conn.commit()
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS search_presets (
                        id SERIAL PRIMARY KEY,
                        name TEXT UNIQUE NOT NULL,
                        settings TEXT NOT NULL
                    )
                '''))
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS watchlist (
                        stock_code TEXT PRIMARY KEY,
                        stock_name TEXT NOT NULL,
                        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                '''))
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
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS search_presets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        settings TEXT NOT NULL
                    )
                '''))
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS watchlist (
                        stock_code TEXT PRIMARY KEY,
                        stock_name TEXT NOT NULL,
                        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                '''))
            
            # Watchlist 새 컬럼들 추가 (버전 업데이트 대비)
            watchlist_columns = [
                ("buy_price", "INTEGER"),
                ("sell_price", "INTEGER"),
                ("youtube_link", "TEXT"),
                ("added_price", "INTEGER")
            ]
            for col_name, col_type in watchlist_columns:
                try:
                    conn.execute(text(f"ALTER TABLE watchlist ADD COLUMN {col_name} {col_type}"))
                except:
                    pass
            
            conn.commit()
    except Exception as e:
        print(f"Database Initialization Failed: {str(e)}")

# Create the DB on load
init_db()
