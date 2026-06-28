"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import { isChosungMatch } from "@/utils/hangul";
import { Settings, Search, X, ChevronLeft, ChevronRight, Star } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function StockChart() {
  const { 
    chartData, kospiData, kosdaqData, isFetchingChart, selectedStock, searchResults,
    chartTimeframe, chartPeriod, chartOffset, chartType,
    showMA5, showMA10, showMA20, showMA60, showMA120, showMA200,
    showVP, showRSI, showBB, showKospi, showKosdaq,
    setChartConfig, selectStock, allStocks, fetchAllStocks,
    watchlist, addToWatchlist, removeFromWatchlist
  } = useStore();
  
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // 최근 본 종목 (로컬 상태 또는 세션 스토리지 기반으로 간단히 구현)
  const [recentStocks, setRecentStocks] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    fetchAllStocks();
    
    // Load recent stocks from localStorage
    const saved = localStorage.getItem('recentStocks');
    if (saved) {
      try { setRecentStocks(JSON.parse(saved)); } catch (e) {}
    }
  }, [fetchAllStocks]);

  // Handle clicking outside search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update recent stocks when selectedStock changes
  useEffect(() => {
    if (selectedStock && allStocks.length > 0) {
      const stock = allStocks.find(s => s.Code === selectedStock) || searchResults.find(s => s.종목코드 === selectedStock);
      if (stock) {
        const item = { code: stock.Code || stock.종목코드, name: stock.Name || stock.종목명, market: stock.Market || stock.시장 };
        setRecentStocks(prev => {
          const filtered = prev.filter(p => p.code !== item.code);
          const updated = [item, ...filtered].slice(0, 5); // Keep max 5
          localStorage.setItem('recentStocks', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [selectedStock, allStocks, searchResults]);

  if (!mounted) return null;

  // Filter stocks for search autocomplete
  const filteredStocks = searchQuery.trim() === "" 
    ? [] 
    : allStocks.filter(s => isChosungMatch(searchQuery, s.Name) || s.Code.includes(searchQuery)).slice(0, 50);

  const handleStockSelect = (code: string, market: string) => {
    selectStock(code, market);
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const inWatchlist = watchlist.some(w => w.stock_code === selectedStock);
  const currentStockInfo = recentStocks.find(r => r.code === selectedStock);

  const toggleWatchlist = () => {
    if (!selectedStock || !currentStockInfo) return;
    if (inWatchlist) {
      removeFromWatchlist(selectedStock);
    } else {
      addToWatchlist({
        stock_code: selectedStock,
        stock_name: currentStockInfo.name,
        added_price: chartData.length > 0 ? chartData[chartData.length - 1].Close : 0
      });
    }
  };

  // --- Chart Preparation ---
  const xDates = chartData.map(d => d.Date);
  const open = chartData.map(d => d.Open);
  const high = chartData.map(d => d.High);
  const low = chartData.map(d => d.Low);
  const close = chartData.map(d => d.Close);
  const volume = chartData.map(d => d.Volume);
  
  const ma5 = chartData.map(d => d.MA5);
  const ma10 = chartData.map(d => d.MA10);
  const ma20 = chartData.map(d => d.MA20);
  const ma60 = chartData.map(d => d.MA60);
  const ma120 = chartData.map(d => d.MA120);
  const ma200 = chartData.map(d => d.MA200);
  
  const bbUp = chartData.map(d => d.BB_up);
  const bbDown = chartData.map(d => d.BB_down);
  const rsi = chartData.map(d => d.RSI);

  // Volume Profile (VP)
  let vpPriceBins: number[] = [];
  let vpVolumes: number[] = [];
  if (showVP && low.length > 0 && high.length > 0) {
    const minPrice = Math.min(...low.filter(v => v != null));
    const maxPrice = Math.max(...high.filter(v => v != null));
    if (minPrice < maxPrice) {
      const bins = 30;
      const binSize = (maxPrice - minPrice) / bins;
      vpVolumes = Array(bins).fill(0);
      for(let i=0; i<bins; i++) vpPriceBins.push(minPrice + (i + 0.5) * binSize);
      for(let i=0; i<chartData.length; i++) {
        let binIdx = Math.floor((close[i] - minPrice) / binSize);
        if(binIdx >= bins) binIdx = bins - 1;
        if(binIdx < 0) binIdx = 0;
        vpVolumes[binIdx] += volume[i];
      }
    }
  }

  const traces: any[] = [];

  // 1. VP (Underlay)
  if (showVP && vpVolumes.length > 0) {
    traces.push({
      y: vpPriceBins, x: vpVolumes, type: 'bar', orientation: 'h',
      xaxis: 'x3', yaxis: 'y', name: '매물대',
      marker: { color: 'rgba(255, 255, 255, 0.08)' }, hoverinfo: 'none', showlegend: false
    });
  }

  // 2. Main Price (Candle or Line)
  if (chartType === '캔들 차트') {
    traces.push({
      x: xDates, open, high, low, close, type: 'candlestick',
      xaxis: 'x', yaxis: 'y', name: 'Price',
      increasing: { line: { color: '#ef4444' } },
      decreasing: { line: { color: '#3b82f6' } },
    });
  } else {
    traces.push({
      x: xDates, y: close, type: 'scatter', mode: 'lines',
      xaxis: 'x', yaxis: 'y', name: 'Price',
      line: { color: '#ffffff', width: 2 }
    });
  }

  // 3. Moving Averages
  if (showMA5) traces.push({ x: xDates, y: ma5, type: 'scatter', mode: 'lines', name: '5일선', line: { color: '#f472b6', width: 1.5 }, hoverinfo: 'none' });
  if (showMA10) traces.push({ x: xDates, y: ma10, type: 'scatter', mode: 'lines', name: '10일선', line: { color: '#c084fc', width: 1.5 }, hoverinfo: 'none' });
  if (showMA20) traces.push({ x: xDates, y: ma20, type: 'scatter', mode: 'lines', name: '20일선', line: { color: '#fb923c', width: 1.5 }, hoverinfo: 'none' });
  if (showMA60) traces.push({ x: xDates, y: ma60, type: 'scatter', mode: 'lines', name: '60일선', line: { color: '#4ade80', width: 1.5 }, hoverinfo: 'none' });
  if (showMA120) traces.push({ x: xDates, y: ma120, type: 'scatter', mode: 'lines', name: '120일선', line: { color: '#38bdf8', width: 1.5 }, hoverinfo: 'none' });
  if (showMA200) traces.push({ x: xDates, y: ma200, type: 'scatter', mode: 'lines', name: '200일선', line: { color: '#f87171', width: 1.5 }, hoverinfo: 'none' });

  // 4. Bollinger Bands
  if (showBB) {
    traces.push({ x: xDates, y: bbUp, type: 'scatter', mode: 'lines', name: 'BB 상단', line: { color: 'rgba(255,255,255,0.3)', dash: 'dot' }, hoverinfo: 'none' });
    traces.push({ x: xDates, y: bbDown, type: 'scatter', mode: 'lines', name: 'BB 하단', line: { color: 'rgba(255,255,255,0.3)', dash: 'dot' }, fill: 'tonexty', fillcolor: 'rgba(255,255,255,0.05)', hoverinfo: 'none' });
  }

  // 5. Volume
  traces.push({
    x: xDates, y: volume, type: 'bar', xaxis: 'x', yaxis: 'y2', name: 'Volume',
    marker: { color: 'rgba(100, 116, 139, 0.5)' }, showlegend: false
  });

  // 6. RSI (14)
  if (showRSI) {
    traces.push({
      x: xDates, y: rsi, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y3', name: 'RSI(14)',
      line: { color: '#a78bfa', width: 1.5 }
    });
    // Add RSI 30/70 lines
    traces.push({ x: [xDates[0], xDates[xDates.length-1]], y: [70, 70], type: 'scatter', mode: 'lines', yaxis: 'y3', line: { color: 'rgba(239,68,68,0.5)', dash: 'dash', width: 1 }, hoverinfo: 'none', showlegend: false });
    traces.push({ x: [xDates[0], xDates[xDates.length-1]], y: [30, 30], type: 'scatter', mode: 'lines', yaxis: 'y3', line: { color: 'rgba(59,130,246,0.5)', dash: 'dash', width: 1 }, hoverinfo: 'none', showlegend: false });
  }

  // 7. Kospi / Kosdaq Overlay (y4 axis - right side)
  if (showKospi && kospiData.length > 0) {
    traces.push({
      x: kospiData.map(d => d.Date), y: kospiData.map(d => d.Pct), type: 'scatter', mode: 'lines', 
      xaxis: 'x', yaxis: 'y4', name: 'KOSPI (%)', line: { color: '#fbbf24', width: 1.5 }
    });
  }
  if (showKosdaq && kosdaqData.length > 0) {
    traces.push({
      x: kosdaqData.map(d => d.Date), y: kosdaqData.map(d => d.Pct), type: 'scatter', mode: 'lines', 
      xaxis: 'x', yaxis: 'y4', name: 'KOSDAQ (%)', line: { color: '#34d399', width: 1.5 }
    });
  }

  // Define Layout Domains
  const yDomain = showRSI ? [0.4, 1] : [0.25, 1];
  const y2Domain = showRSI ? [0.2, 0.35] : [0, 0.2];
  const y3Domain = showRSI ? [0, 0.15] : [0, 0];

  return (
    <div className="w-full h-full flex flex-col bg-dark-panel p-4 relative">
      
      {/* 1. Header Controls */}
      <div className="flex flex-col gap-3 mb-2 z-20">
        
        {/* Top Row: Recent Stocks & Search Bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-xs text-slate-500 whitespace-nowrap mr-1">최근 본 종목:</span>
            {recentStocks.map((s, idx) => (
              <button 
                key={idx} 
                onClick={() => handleStockSelect(s.code, s.market)}
                className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${selectedStock === s.code ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="relative" ref={searchRef}>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-blue-500">
              <Search size={14} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="종목명 또는 코드 검색" 
                className="bg-transparent text-sm text-white outline-none w-48"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
              />
              {searchQuery && <X size={14} className="text-slate-400 cursor-pointer hover:text-white" onClick={() => setSearchQuery("")} />}
            </div>
            
            {showSearchDropdown && filteredStocks.length > 0 && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar py-1 z-50">
                {filteredStocks.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="px-4 py-2 hover:bg-blue-600/30 cursor-pointer flex justify-between items-center"
                    onClick={() => handleStockSelect(s.Code, s.Market)}
                  >
                    <span className="text-white text-sm">{s.Name}</span>
                    <span className="text-slate-400 text-xs">{s.Code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Controls */}
        <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          
          {/* Title & Watchlist */}
          <div className="flex items-center gap-3 w-1/4">
            {selectedStock ? (
              <>
                <h3 className="text-lg font-bold text-white truncate">
                  {currentStockInfo?.name || allStocks.find(s => s.Code === selectedStock)?.Name || watchlist.find(w => w.stock_code === selectedStock)?.stock_name || selectedStock} 
                  <span className="text-sm font-normal text-slate-400 ml-1">{selectedStock}</span>
                </h3>
                <button onClick={toggleWatchlist} className={`p-1.5 rounded-lg transition-colors ${inWatchlist ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-500 hover:text-yellow-400 hover:bg-slate-800'}`}>
                  <Star size={18} fill={inWatchlist ? "currentColor" : "none"} />
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-500">종목 미선택</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Timeframe */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
              {['일봉', '주봉', '월봉', '30분봉'].map(tf => (
                <button 
                  key={tf}
                  onClick={() => setChartConfig('chartTimeframe', tf)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${chartTimeframe === tf ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Period Dropdown */}
            <select 
              value={chartPeriod}
              onChange={(e) => setChartConfig('chartPeriod', e.target.value)}
              className="bg-slate-900 text-white text-xs border border-slate-700 rounded-lg px-2 py-1.5 outline-none"
            >
              {chartTimeframe === '30분봉' ? (
                <>
                  <option value="1일">1일</option>
                  <option value="1주일">1주일</option>
                  <option value="1달">1달</option>
                </>
              ) : (
                <>
                  <option value="10년 (전체)">10년 (전체)</option>
                  <option value="5년">5년</option>
                  <option value="1년">1년</option>
                  <option value="6개월">6개월</option>
                  <option value="3달">3달</option>
                  <option value="1달">1달</option>
                  <option value="1주일">1주일</option>
                  <option value="1일">1일</option>
                </>
              )}
            </select>

            {/* Pagination / Offset */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
              <button 
                onClick={() => setChartConfig('chartOffset', chartOffset + 1)}
                className="p-1 hover:bg-slate-700 rounded text-slate-300"
                title="과거로 이동"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-500 px-1">{chartOffset === 0 ? '최근' : `-${chartOffset}`}</span>
              <button 
                onClick={() => setChartConfig('chartOffset', Math.max(0, chartOffset - 1))}
                disabled={chartOffset === 0}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                title="현재로 이동"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border transition-colors ${showSettings ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
            >
              <Settings size={18} />
            </button>
          </div>

        </div>
      </div>

      {/* Settings Popover */}
      {showSettings && (
        <div className="absolute top-28 right-4 z-30 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-4 shadow-2xl w-80 text-sm">
          <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white">⚙️ 고급 차트 옵션</h4>
            <X size={16} className="text-slate-400 cursor-pointer hover:text-white" onClick={() => setShowSettings(false)} />
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">차트 형태</label>
              <div className="flex gap-2">
                {['캔들 차트', '선 차트'].map(t => (
                  <button key={t} onClick={() => setChartConfig('chartType', t)} className={`px-3 py-1.5 rounded text-xs flex-1 ${chartType === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">이동평균선 (MA)</label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA5} onChange={e => setChartConfig('showMA5', e.target.checked)} className="accent-pink-500" /> 5선</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA10} onChange={e => setChartConfig('showMA10', e.target.checked)} className="accent-purple-400" /> 10선</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA20} onChange={e => setChartConfig('showMA20', e.target.checked)} className="accent-orange-400" /> 20선</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA60} onChange={e => setChartConfig('showMA60', e.target.checked)} className="accent-green-400" /> 60선</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA120} onChange={e => setChartConfig('showMA120', e.target.checked)} className="accent-sky-400" /> 120선</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showMA200} onChange={e => setChartConfig('showMA200', e.target.checked)} className="accent-red-400" /> 200선</label>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">보조 지표 & 오버레이</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showVP} onChange={e => setChartConfig('showVP', e.target.checked)} className="accent-blue-500" /> 매물대 (Volume Profile)</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showRSI} onChange={e => setChartConfig('showRSI', e.target.checked)} className="accent-blue-500" /> RSI (14)</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showBB} onChange={e => setChartConfig('showBB', e.target.checked)} className="accent-blue-500" /> 볼린저밴드</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showKospi} onChange={e => setChartConfig('showKospi', e.target.checked)} className="accent-blue-500" /> 코스피 (KOSPI) 비교</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={showKosdaq} onChange={e => setChartConfig('showKosdaq', e.target.checked)} className="accent-blue-500" /> 코스닥 (KOSDAQ) 비교</label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Chart Plot */}
      {isFetchingChart ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !selectedStock || chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          종목을 선택하거나 검색하여 차트를 확인하세요.
        </div>
      ) : (
        <div className="flex-1 relative mt-2 border border-slate-800 rounded-xl overflow-hidden bg-[#0a0f18]">
          <Plot
            data={traces}
            layout={{
              autosize: true,
              margin: { l: 50, r: 50, b: 30, t: 20 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#64748b', size: 11 },
              xaxis: {
                type: 'category',
                rangeslider: { visible: false },
                gridcolor: '#1e293b',
                zeroline: false
              },
              yaxis: {
                domain: yDomain,
                gridcolor: '#1e293b',
                zeroline: false
              },
              yaxis2: {
                domain: y2Domain,
                showgrid: false,
                zeroline: false,
                title: '거래량',
                titlefont: { size: 10 }
              },
              yaxis3: {
                domain: y3Domain,
                gridcolor: '#1e293b',
                zeroline: false,
                title: 'RSI',
                titlefont: { size: 10 },
                tickvals: [30, 70]
              },
              yaxis4: {
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                zeroline: false,
                title: '지수(%)',
                titlefont: { size: 10 }
              },
              xaxis3: {
                overlaying: 'x',
                side: 'top',
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: vpVolumes.length > 0 ? [0, Math.max(...vpVolumes) * 3] : [0, 1]
              },
              showlegend: true,
              legend: {
                orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1,
                font: { color: '#94a3b8', size: 10 }, bgcolor: 'transparent'
              },
              barmode: 'overlay',
              hovermode: 'x unified'
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false }}
          />
        </div>
      )}
    </div>
  );
}
