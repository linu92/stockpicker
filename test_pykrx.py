from pykrx import stock
import datetime
import pandas as pd

# get last business day
today = datetime.datetime.today()
b_days = stock.get_business_days_of_month(today.year, today.month)
if len(b_days) == 0:
    today = today.replace(day=1) - datetime.timedelta(days=1)
    b_days = stock.get_business_days_of_month(today.year, today.month)
last_b_day = b_days[-1].strftime("%Y%m%d")

print(f"Using date: {last_b_day}")

# get market cap (returns index=티커, columns: 종가, 시가총액, 거래량, 거래대금, 상장주식수)
df_kospi = stock.get_market_cap(last_b_day, market="KOSPI")
df_kospi['Market'] = 'KOSPI'

df_kosdaq = stock.get_market_cap(last_b_day, market="KOSDAQ")
df_kosdaq['Market'] = 'KOSDAQ'

df = pd.concat([df_kospi, df_kosdaq])
df = df.reset_index()

# Ticker to Name mapping
# get_market_ticker_list returns list of tickers
# actually we can just iterate and map? It's fast if we just map
tickers = df['티커'].tolist()
# is there a bulk way?
# actually pykrx caches it. Let's just do:
# names = [stock.get_market_ticker_name(t) for t in tickers]
print(df.head())
