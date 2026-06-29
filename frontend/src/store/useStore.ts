import { create } from 'zustand';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface SearchParams {
  min_price: number;
  max_price: number;
  min_marcap_b: number;
  min_amount_b: number;
  exclude_preferred: boolean;
  exclude_etf_spac: boolean;
  exclude_new_listing: boolean;
  use_step2: boolean;
  use_step2_1: boolean;
  use_step2_2: boolean;
  use_step3: boolean;
  step3_decline_min: number;
  step3_decline_max: number;
  use_step4: boolean;
  step4_vol_type: string;
  step4_vol_ratio: number;
  step4_vol_avg_days: number;
  use_step5: boolean;
  step2_ma_short: number;
  step2_ma_long: number;
  rising_ma10: boolean;
  rising_ma20: boolean;
  rising_ma50: boolean;
}

interface AppState {
  viewMode: 'search' | 'news' | 'watchlist';
  setViewMode: (mode: 'search' | 'news' | 'watchlist') => void;
  
  searchParams: SearchParams;
  setSearchParams: (params: Partial<SearchParams>) => void;
  
  searchResults: any[];
  isSearching: boolean;
  searchProgress: number;
  searchTotal: number;
  stepCounts: Record<number, number>;
  searchStatusMessage: string;
  performSearch: () => Promise<void>;
  
  selectedStock: string | null;
  selectedStockMarket: string | null;
  chartData: any[];
  kospiData: any[];
  kosdaqData: any[];
  isFetchingChart: boolean;
  
  // Chart Configs
  chartTimeframe: '일봉' | '주봉' | '월봉' | '30분봉';
  chartPeriod: '1일' | '1주일' | '1달' | '3달' | '6달' | '1년' | '5년' | '10년 (전체)';
  chartOffset: number;
  chartType: '캔들 차트' | '선 차트';
  showMA5: boolean;
  showMA10: boolean;
  showMA20: boolean;
  showMA60: boolean;
  showMA120: boolean;
  showMA200: boolean;
  showVP: boolean;
  showRSI: boolean;
  showBB: boolean;
  showKospi: boolean;
  showKosdaq: boolean;
  
  setChartConfig: (key: string, value: any) => void;
  selectStock: (code: string, market?: string) => Promise<void>;
  fetchChartData: () => Promise<void>;

  // News State
  newsKeyword: string;
  setNewsKeyword: (kw: string) => void;
  newsList: any[];
  isFetchingNews: boolean;
  fetchNews: () => void;
  triggerNewsCrawl: () => void;
  selectedNewsHtml: string | null;
  setSelectedNewsHtml: (html: string | null) => void;
  fetchNewsContent: (url: string) => void;
  isCrawlingNews: boolean;
  crawlNewsProgress: number;
  crawlNewsTotal: number;
  crawlStatusMessage: string;

  // Watchlist State
  watchlist: any[];
  isFetchingWatchlist: boolean;
  fetchWatchlist: () => Promise<void>;
  addToWatchlist: (data: { stock_code: string, stock_name: string, added_price?: number }) => Promise<void>;
  removeFromWatchlist: (code: string) => Promise<void>;
  
  // All Stocks for direct search
  allStocks: any[];
  fetchAllStocks: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  viewMode: 'search',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  searchParams: {
    min_price: 1000,
    max_price: 500000,
    min_marcap_b: 1000,
    min_amount_b: 200,
    exclude_preferred: true,
    exclude_etf_spac: true,
    exclude_new_listing: true,
    use_step2: true,
    use_step2_1: true,
    use_step2_2: true,
    use_step3: true,
    step3_decline_min: 10.0,
    step3_decline_max: 30.0,
    use_step4: true,
    step4_vol_type: "전일 대비",
    step4_vol_ratio: 2.0,
    step4_vol_avg_days: 5,
    use_step5: true,
    step2_ma_short: 20,
    step2_ma_long: 60,
    rising_ma10: false,
    rising_ma20: true,
    rising_ma50: false,
  },
  
  setSearchParams: (params) => set((state) => ({ 
    searchParams: { ...state.searchParams, ...params } 
  })),
  
  searchResults: [],
  isSearching: false,
  searchProgress: 0,
  searchTotal: 0,
  stepCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  searchStatusMessage: "",
  
  performSearch: async () => {
    set({ 
      isSearching: true, 
      searchResults: [], 
      searchProgress: 0, 
      searchTotal: 0,
      stepCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      searchStatusMessage: "서버에 연결 중..." 
    });
    try {
      const response = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(get().searchParams),
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "progress") {
              set((state) => ({ 
                searchProgress: parsed.current, 
                searchTotal: parsed.total, 
                stepCounts: parsed.step_counts || state.stepCounts,
                searchStatusMessage: "개별 종목 분석 중..." 
              }));
            } else if (parsed.type === "result") {
              set((state) => ({ searchResults: [...state.searchResults, parsed.data] }));
            } else if (parsed.type === "status") {
              set({ searchStatusMessage: parsed.message });
            }
          } catch (e) {
            console.error("Failed to parse JSON stream line:", line, e);
          }
        }
      }
    } catch (error) {
      console.error("Search failed", error);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      set({ isSearching: false, searchStatusMessage: "" });
    }
  },
  
  selectedStock: null,
  selectedStockMarket: null,
  chartData: [],
  kospiData: [],
  kosdaqData: [],
  isFetchingChart: false,
  
  chartTimeframe: '일봉',
  chartPeriod: '3달',
  chartOffset: 0,
  chartType: '캔들 차트',
  showMA5: false,
  showMA10: false,
  showMA20: true,
  showMA60: true,
  showMA120: false,
  showMA200: false,
  showVP: false,
  showRSI: false,
  showBB: false,
  showKospi: false,
  showKosdaq: false,
  
  setChartConfig: (key, value) => {
    set((state) => {
      const nextState = { ...state, [key]: value };
      // Reset offset if timeframe or period changes
      if (key === 'chartTimeframe' || key === 'chartPeriod') {
        nextState.chartOffset = 0;
      }
      return nextState;
    });
    // fetchChartData needs to be called after state updates
    get().fetchChartData();
  },
  
  selectStock: async (code, market) => {
    set({ selectedStock: code, selectedStockMarket: market || 'KOSPI', chartOffset: 0 });
    await get().fetchChartData();
  },
  
  fetchChartData: async () => {
    const state = get();
    if (!state.selectedStock) return;
    
    set({ isFetchingChart: true, chartData: [], kospiData: [], kosdaqData: [] });
    try {
      const params = new URLSearchParams({
        timeframe: state.chartTimeframe,
        period: state.chartPeriod,
        chart_offset: state.chartOffset.toString(),
        market: state.selectedStockMarket || 'KOSPI',
        show_kospi: state.showKospi.toString(),
        show_kosdaq: state.showKosdaq.toString()
      });
      const res = await axios.get(`${API_BASE}/api/chart/${state.selectedStock}?${params.toString()}`);
      set({ 
        chartData: res.data.data || [],
        kospiData: res.data.kospi || [],
        kosdaqData: res.data.kosdaq || []
      });
    } catch (error) {
      console.error("Chart fetch failed", error);
    } finally {
      set({ isFetchingChart: false });
    }
  },

  // News
  newsKeyword: "전체",
  setNewsKeyword: (kw) => set({ newsKeyword: kw }),
  newsList: [],
  isFetchingNews: false,
  fetchNews: async () => {
    set({ isFetchingNews: true });
    try {
      const res = await axios.get(`${API_BASE}/api/news?keyword=${get().newsKeyword}`);
      set({ newsList: res.data.data || [] });
    } catch (error) {
      console.error("News fetch failed", error);
    } finally {
      set({ isFetchingNews: false });
    }
  },
  isCrawlingNews: false,
  crawlNewsProgress: 0,
  crawlNewsTotal: 0,
  crawlStatusMessage: "",
  
  triggerNewsCrawl: async () => {
    set({ 
      isCrawlingNews: true, 
      crawlNewsProgress: 0, 
      crawlNewsTotal: 0, 
      crawlStatusMessage: "크롤링 준비 중..." 
    });
    
    try {
      const response = await fetch(`${API_BASE}/api/news/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: get().newsKeyword }),
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "progress") {
              set({ 
                crawlNewsProgress: parsed.current, 
                crawlNewsTotal: parsed.total, 
                crawlStatusMessage: parsed.message || "크롤링 중..." 
              });
            }
          } catch (e) {
            console.error("Failed to parse JSON stream line:", line, e);
          }
        }
      }
      
      // When done, fetch the latest news automatically
      get().fetchNews();
    } catch (error) {
      console.error("Crawl trigger failed", error);
      alert("크롤링 중 오류가 발생했습니다.");
    } finally {
      set({ isCrawlingNews: false, crawlStatusMessage: "" });
    }
  },
  selectedNewsHtml: null,
  fetchNewsContent: async (url) => {
    set({ selectedNewsHtml: "<div class='text-center p-8'><div class='w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto'></div><p class='mt-4'>기사 본문을 불러오는 중...</p></div>" });
    try {
      const res = await axios.get(`${API_BASE}/api/news/content?url=${encodeURIComponent(url)}`);
      set({ selectedNewsHtml: res.data.html });
      // Refresh news list to update is_read
      get().fetchNews();
    } catch (error) {
      set({ selectedNewsHtml: "<div>기사 본문 로딩 실패</div>" });
    }
  },
  
  setSelectedNewsHtml: (html) => set({ selectedNewsHtml: html }),

  // Watchlist
  watchlist: [],
  isFetchingWatchlist: false,
  fetchWatchlist: async () => {
    set({ isFetchingWatchlist: true });
    try {
      const res = await axios.get(`${API_BASE}/api/watchlist`);
      set({ watchlist: res.data.data || [] });
    } catch (error) {
      console.error("Watchlist fetch failed", error);
    } finally {
      set({ isFetchingWatchlist: false });
    }
  },
  addToWatchlist: async (item) => {
    try {
      await axios.post(`${API_BASE}/api/watchlist`, item);
      get().fetchWatchlist();
      alert("관심 종목에 추가되었습니다.");
    } catch (error) {
      console.error("Add to watchlist failed", error);
    }
  },
  removeFromWatchlist: async (code) => {
    try {
      await axios.delete(`${API_BASE}/api/watchlist/${code}`);
      get().fetchWatchlist();
    } catch (error) {
      console.error(error);
    }
  },
  
  allStocks: [],
  fetchAllStocks: async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/market/listings`);
      set({ allStocks: res.data.data || [] });
    } catch (error) {
      console.error("Failed to fetch all stocks", error);
    }
  }
}));
