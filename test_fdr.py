import FinanceDataReader as fdr

try:
    df = fdr.StockListing('KRX-DESC')
    print("KRX-DESC success!")
    print(df.head())
    print(df.columns)
except Exception as e:
    print("KRX-DESC failed:", e)

try:
    df = fdr.StockListing('KRX')
    print("KRX success!")
    print(df.head())
    print(df.columns)
except Exception as e:
    print("KRX failed:", e)
