"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Search } from "lucide-react";

export default function TopOptionNavigator() {
  const { 
    viewMode, searchParams, setSearchParams, performSearch, isSearching, searchProgress, searchTotal, searchStatusMessage, 
    newsKeyword, setNewsKeyword, fetchNews, triggerNewsCrawl, isCrawlingNews, crawlNewsProgress, crawlNewsTotal, crawlStatusMessage,
    fetchWatchlist 
  } = useStore();
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSearching) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  if (viewMode === 'search') {
    return (
      <div className="bg-dark-panel border border-dark-border rounded-2xl shadow-xl p-4 mb-4 flex flex-col gap-4">
        {/* Horizontal scrollable cards for steps */}
        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {/* Step 1 */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 min-w-[250px] shrink-0">
            <label className="text-xs font-bold text-blue-400 block mb-2">1단계: 기본 필터</label>
            <div className="flex gap-2 items-center mb-3">
              <input type="number" value={searchParams.min_price} onChange={e => setSearchParams({ min_price: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최소" />
              <span className="text-slate-500">~</span>
              <input type="number" value={searchParams.max_price} onChange={e => setSearchParams({ max_price: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최대" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">우선주 제외</span>
              <input type="checkbox" checked={searchParams.exclude_preferred} onChange={e => setSearchParams({ exclude_preferred: e.target.checked })} className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">ETF/ETN/스팩 제외</span>
              <input type="checkbox" checked={searchParams.exclude_etf_spac} onChange={e => setSearchParams({ exclude_etf_spac: e.target.checked })} className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">신규상장 제외</span>
              <input type="checkbox" checked={searchParams.exclude_new_listing} onChange={e => setSearchParams({ exclude_new_listing: e.target.checked })} className="w-4 h-4 accent-blue-500" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 min-w-[250px] shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-blue-400 block">2단계: 정배열</label>
              <input type="checkbox" checked={searchParams.use_step2} onChange={e => setSearchParams({ use_step2: e.target.checked })} className="w-4 h-4 accent-blue-500" />
            </div>
            {searchParams.use_step2 && (
              <div className="mt-2 space-y-3 opacity-90">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">단기 &gt; 장기</span>
                  <input type="checkbox" checked={searchParams.use_step2_1} onChange={e => setSearchParams({ use_step2_1: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
                {searchParams.use_step2_1 && (
                  <div className="flex gap-2">
                    <select value={searchParams.step2_ma_short} onChange={e => setSearchParams({ step2_ma_short: Number(e.target.value) })} className="w-1/2 bg-slate-900 border border-slate-700 text-white rounded p-1 text-sm">
                      <option value={5}>5일선</option><option value={10}>10일선</option><option value={20}>20일선</option>
                    </select>
                    <select value={searchParams.step2_ma_long} onChange={e => setSearchParams({ step2_ma_long: Number(e.target.value) })} className="w-1/2 bg-slate-900 border border-slate-700 text-white rounded p-1 text-sm">
                      <option value={20}>20일선</option><option value={60}>60일선</option><option value={120}>120일선</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">이평선 우상향</span>
                  <input type="checkbox" checked={searchParams.use_step2_2} onChange={e => setSearchParams({ use_step2_2: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
                {searchParams.use_step2_2 && (
                  <div className="flex justify-between text-sm text-slate-300">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma10} onChange={e => setSearchParams({ rising_ma10: e.target.checked })} className="accent-blue-500" />10일</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma20} onChange={e => setSearchParams({ rising_ma20: e.target.checked })} className="accent-blue-500" />20일</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma50} onChange={e => setSearchParams({ rising_ma50: e.target.checked })} className="accent-blue-500" />50일</label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 min-w-[200px] shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-blue-400 block">3단계: 눌림 발생</label>
              <input type="checkbox" checked={searchParams.use_step3} onChange={e => setSearchParams({ use_step3: e.target.checked })} className="w-4 h-4 accent-blue-500" />
            </div>
            {searchParams.use_step3 && (
              <div className="mt-2 space-y-2 opacity-90">
                <div className="flex gap-2 items-center">
                  <input type="number" value={searchParams.step3_decline_min} onChange={e => setSearchParams({ step3_decline_min: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최소 %" />
                  <span className="text-slate-500">~</span>
                  <input type="number" value={searchParams.step3_decline_max} onChange={e => setSearchParams({ step3_decline_max: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최대 %" />
                </div>
              </div>
            )}
          </div>

          {/* Step 4 & 5 */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 min-w-[220px] shrink-0 flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-blue-400 block">4단계: 반등 신호</label>
                <input type="checkbox" checked={searchParams.use_step4} onChange={e => setSearchParams({ use_step4: e.target.checked })} className="w-4 h-4 accent-blue-500" />
              </div>
              {searchParams.use_step4 && (
                <div className="mt-2 space-y-2 opacity-90">
                  <select value={searchParams.step4_vol_type} onChange={e => setSearchParams({ step4_vol_type: e.target.value })} className="w-full bg-slate-900 border border-slate-700 text-white rounded p-1 text-sm mb-2">
                    <option value="전일 대비">전일 대비 거래량</option>
                    <option value="최근 평균 대비">최근 평균 대비 거래량</option>
                  </select>
                  <div className="flex gap-2 items-center text-sm text-slate-300">
                    <input type="number" step="0.1" value={searchParams.step4_vol_ratio} onChange={e => setSearchParams({ step4_vol_ratio: Number(e.target.value) })} className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-white text-center" />
                    <span>배 이상 회복</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-blue-400 block">5단계: 급등 제외</label>
                <input type="checkbox" checked={searchParams.use_step5} onChange={e => setSearchParams({ use_step5: e.target.checked })} className="w-4 h-4 accent-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end border-t border-dark-border pt-4">
          {isSearching ? (
            <div className="flex-1 bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-inner flex items-center justify-between gap-4">
              <div className="text-xs text-slate-400 min-w-[120px]">
                {searchStatusMessage || '분석 중...'}
                {searchTotal > 0 && <span className="ml-2 font-bold text-white">{searchProgress} / {searchTotal}</span>}
              </div>
              <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                <div 
                  className={`${searchTotal > 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-blue-500/50 animate-pulse'} h-full rounded-full transition-all duration-300 ease-out`}
                  style={{ width: `${searchTotal > 0 ? (searchProgress / searchTotal) * 100 : 100}%` }}
                ></div>
              </div>
              <div className="text-xs font-medium text-blue-400 min-w-[60px] text-right">{elapsedTime}초</div>
            </div>
          ) : (
            <button 
              onClick={performSearch}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
            >
              <Search size={18} />
              조건 검색 실행
            </button>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'news') {
    return (
      <div className="bg-dark-panel border border-dark-border rounded-2xl shadow-xl p-4 mb-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <label className="text-xs text-slate-400 block mb-2">키워드 입력</label>
          <input 
            type="text" 
            value={newsKeyword}
            onChange={e => setNewsKeyword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500" 
            placeholder="예: 삼성전자, 배터리" 
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-2 md:mt-6">
          <button 
            onClick={fetchNews}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all whitespace-nowrap"
          >
            저장된 뉴스 보기
          </button>
          
          {isCrawlingNews ? (
            <div className="flex-1 sm:w-64 bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-inner flex flex-col justify-center">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span className="truncate">{crawlStatusMessage || '뉴스 크롤링 중...'}</span>
                {crawlNewsTotal > 0 && <span>{crawlNewsProgress} / {crawlNewsTotal}</span>}
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`${crawlNewsTotal > 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-purple-500/50 animate-pulse'} h-1.5 rounded-full transition-all duration-300 ease-out`}
                  style={{ width: `${crawlNewsTotal > 0 ? (crawlNewsProgress / crawlNewsTotal) * 100 : 100}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <button 
              onClick={triggerNewsCrawl}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition-all whitespace-nowrap"
            >
              새로 크롤링
            </button>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'watchlist') {
    return (
      <div className="bg-dark-panel border border-dark-border rounded-2xl shadow-xl p-4 mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-400">관심 종목 관리</h2>
          <p className="text-xs text-slate-500 mt-1">우측 표에서 종목을 관리할 수 있습니다.</p>
        </div>
        <button 
          onClick={fetchWatchlist}
          className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg transition-all"
        >
          새로고침
        </button>
      </div>
    );
  }

  return null;
}
