from pydantic import BaseModel
from typing import Optional

class SearchRequest(BaseModel):
    min_price: int = 1000
    max_price: int = 500000
    min_marcap_b: int = 1000
    min_amount_b: int = 200
    exclude_preferred: bool = True
    exclude_etf_spac: bool = True
    exclude_new_listing: bool = True
    use_step2: bool = True
    use_step2_1: bool = True
    use_step2_2: bool = True
    use_step3: bool = True
    step3_decline_min: float = 10.0
    step3_decline_max: float = 30.0
    use_step4: bool = True
    step4_vol_type: str = "전일 대비"
    step4_vol_ratio: float = 2.0
    step4_vol_avg_days: int = 5
    use_step5: bool = True
    step2_ma_short: int = 20
    step2_ma_long: int = 60
    rising_ma10: bool = False
    rising_ma20: bool = True
    rising_ma50: bool = False
