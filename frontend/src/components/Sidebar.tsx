"use client";

import { useState, useEffect } from "react";
import { Search, Newspaper, Star, Plus, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Sidebar() {
  const { 
    isSidebarCollapsed, toggleSidebar, viewMode, setViewMode, 
    searchParams, setSearchParams, performSearch, isSearching, searchProgress, searchTotal, searchStatusMessage, 
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

  return (
    <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-80'} transition-all duration-300 bg-dark-panel border-r border-dark-border h-full flex flex-col p-4 shadow-xl shrink-0 relative`}>
      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow-lg z-50 border border-slate-700"
      >
        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="mb-6 overflow-hidden whitespace-nowrap">
        {isSidebarCollapsed ? (
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent text-center">
            SP
          </h1>
        ) : (
          <>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              StockPicker V2
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Premium Screener
              {process.env.NEXT_PUBLIC_BUILD_TIME && (
                <span className="ml-2 px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-500">
                  Build: {process.env.NEXT_PUBLIC_BUILD_TIME}
                </span>
              )}
            </p>
          </>
        )}
      </div>

      {!isSidebarCollapsed && viewMode === 'search' && (
        <>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 pl-1">검색 조건 설정</h2>
            <div className="space-y-4">
              {/* 1단계 */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <label className="text-xs text-slate-400 block mb-2 font-bold text-blue-400">1단계: 기본 필터</label>
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

              {/* 2단계 */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-blue-400 block">2단계: 이동평균선 정배열</label>
                  <input type="checkbox" checked={searchParams.use_step2} onChange={e => setSearchParams({ use_step2: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
                {searchParams.use_step2 && (
                  <div className="mt-2 space-y-3 opacity-90 transition-opacity">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">단기 &gt; 장기 이평선</span>
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
                        <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma10} onChange={e => setSearchParams({ rising_ma10: e.target.checked })} className="accent-blue-500" />10일선</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma20} onChange={e => setSearchParams({ rising_ma20: e.target.checked })} className="accent-blue-500" />20일선</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={searchParams.rising_ma50} onChange={e => setSearchParams({ rising_ma50: e.target.checked })} className="accent-blue-500" />50일선</label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3단계 */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-blue-400 block">3단계: 눌림 발생</label>
                  <input type="checkbox" checked={searchParams.use_step3} onChange={e => setSearchParams({ use_step3: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
                {searchParams.use_step3 && (
                  <div className="mt-2 space-y-2 opacity-90 transition-opacity">
                    <div className="flex gap-2 items-center">
                      <input type="number" value={searchParams.step3_decline_min} onChange={e => setSearchParams({ step3_decline_min: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최소 %" />
                      <span className="text-slate-500">~</span>
                      <input type="number" value={searchParams.step3_decline_max} onChange={e => setSearchParams({ step3_decline_max: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="최대 %" />
                    </div>
                  </div>
                )}
              </div>

              {/* 4단계 */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-blue-400 block">4단계: 반등 신호</label>
                  <input type="checkbox" checked={searchParams.use_step4} onChange={e => setSearchParams({ use_step4: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
                {searchParams.use_step4 && (
                  <div className="mt-2 space-y-2 opacity-90 transition-opacity">
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

              {/* 5단계 */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-blue-400 block">5단계: 최근 급등 종목 제외</label>
                  <input type="checkbox" checked={searchParams.use_step5} onChange={e => setSearchParams({ use_step5: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                </div>
              </div>

            </div>
            
            <div className="mt-6 pt-4 border-t border-dark-border">
              {isSearching ? (
                <div className="w-full bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-inner">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>{searchStatusMessage || '검색 및 분석 중...'}</span>
                    {searchTotal > 0 && <span>{searchProgress} / {searchTotal}</span>}
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`${searchTotal > 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-blue-500/50 animate-pulse'} h-2.5 rounded-full transition-all duration-300 ease-out`}
                      style={{ width: `${searchTotal > 0 ? (searchProgress / searchTotal) * 100 : 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2 px-1">
                    <div className="text-[10px] text-slate-500">잠시만 기다려주세요</div>
                    <div className="text-[10px] font-medium text-blue-400">{elapsedTime}초 경과</div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={performSearch}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                >
                  조건 검색 실행
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'news' && (
        <>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 pl-1">뉴스 검색 조건</h2>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-2">키워드 입력</label>
                <input 
                  type="text" 
                  value={newsKeyword}
                  onChange={e => setNewsKeyword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" 
                  placeholder="예: 삼성전자, 배터리" 
                />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-dark-border flex flex-col gap-2">
              <button 
                onClick={fetchNews}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
              >
                저장된 뉴스 보기
              </button>
              
              {isCrawlingNews ? (
                <div className="w-full bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-inner">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>{crawlStatusMessage || '뉴스 크롤링 중...'}</span>
                    {crawlNewsTotal > 0 && <span>{crawlNewsProgress} / {crawlNewsTotal}</span>}
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`${crawlNewsTotal > 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-purple-500/50 animate-pulse'} h-2.5 rounded-full transition-all duration-300 ease-out`}
                      style={{ width: `${crawlNewsTotal > 0 ? (crawlNewsProgress / crawlNewsTotal) * 100 : 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2 px-1">
                    <div className="text-[10px] text-slate-500">잠시만 기다려주세요</div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={triggerNewsCrawl}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  새로 크롤링
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'watchlist' && (
        <>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 pl-1">관심 종목 관리</h2>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <p className="text-xs text-slate-400">
                우측 메인 화면에서 새로운 종목을 찾아 추가하거나 관리할 수 있습니다.
              </p>
            </div>
            
            <div className="mt-6 pt-4 border-t border-dark-border">
              <button 
                onClick={fetchWatchlist}
                className="w-full py-3 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg transition-all"
              >
                새로고침
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
