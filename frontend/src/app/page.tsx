"use client";

import TopOptionNavigator from "@/components/TopOptionNavigator";
import BottomTaskbar from "@/components/BottomTaskbar";
import StockChart from "@/components/StockChart";
import NewsView from "@/components/NewsView";
import WatchlistView from "@/components/WatchlistView";
import { useStore } from "@/store/useStore";
import { Star } from "lucide-react";

export default function Home() {
  const { searchResults, isSearching, viewMode, selectStock, selectedStock, addToWatchlist, watchlist, stepCounts } = useStore();

  return (
    <div className="flex flex-col w-full min-h-screen relative pb-20 md:pb-0 bg-dark-bg">
      <BottomTaskbar />
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto mb-20 max-w-7xl mx-auto w-full">
        <header className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {viewMode === 'search' && "🔍 조건 검색 결과"}
              {viewMode === 'news' && "📰 기사보기 모드"}
              {viewMode === 'watchlist' && "⭐ 관심 종목 모드"}
            </h2>
            <p className="text-slate-400">
              {viewMode === 'search' && "좌측 사이드바에서 조건을 설정하고 검색을 실행해주세요."}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-slate-300">
              코스피: <span className="text-red-400">2,600.00</span>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-slate-300">
              코스닥: <span className="text-blue-400">800.00</span>
            </div>
          </div>
        </header>

        <TopOptionNavigator />

        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {viewMode === 'search' && (
            <>
              {/* Chart Area */}
              <div className="min-h-[400px] bg-dark-panel border border-dark-border rounded-2xl shadow-xl overflow-hidden">
                <StockChart />
              </div>

              {/* Table Area */}
              <div className="flex-1 min-h-[300px] bg-dark-panel border border-dark-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
                {searchResults.length > 0 || isSearching ? (
                  <div className="flex-1 overflow-auto custom-scrollbar p-4 relative">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-800/50 text-slate-400 sticky top-0 z-10">
                        <tr>
                          <th className="p-4 font-medium rounded-tl-xl">종목코드</th>
                          <th className="p-4 font-medium">종목명</th>
                          <th className="p-4 font-medium">현재가</th>
                          <th className="p-4 font-medium">시가총액(억)</th>
                          <th className="p-4 font-medium">평균거래대금(억)</th>
                          <th className="p-4 font-medium">시장</th>
                          <th className="p-4 font-medium rounded-tr-xl">관심종목</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-border relative z-0">
                        {searchResults.map((item, idx) => {
                          const inWatchlist = watchlist.some(w => w.stock_code === item.종목코드);
                          return (
                            <tr 
                              key={idx} 
                              onClick={() => selectStock(item.종목코드, item.시장)}
                              className={`transition-colors cursor-pointer ${selectedStock === item.종목코드 ? 'bg-blue-600/20 border-l-4 border-blue-500' : 'hover:bg-slate-800/30'}`}
                            >
                              <td className="p-4">{item.종목코드}</td>
                              <td className="p-4 font-bold text-white">{item.종목명}</td>
                              <td className="p-4">{item.현재가.toLocaleString()}</td>
                              <td className="p-4">{item['시가총액(억)'].toLocaleString()}</td>
                              <td className="p-4">{item['20일 평균거래대금(억)'].toLocaleString()}</td>
                              <td className="p-4">{item.시장}</td>
                              <td className="p-4">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if(!inWatchlist) {
                                      addToWatchlist({
                                        stock_code: item.종목코드,
                                        stock_name: item.종목명,
                                        added_price: item.현재가
                                      });
                                    }
                                  }}
                                  disabled={inWatchlist}
                                  className={`p-2 rounded-lg transition-colors ${inWatchlist ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-700'}`}
                                >
                                  <Star size={18} fill={inWatchlist ? "currentColor" : "none"} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {isSearching && (
                          <tr>
                            <td colSpan={7} className="p-8 bg-slate-900/50">
                              <div className="font-mono text-xs text-green-400 max-w-lg mx-auto bg-black p-4 rounded-lg border border-slate-700 shadow-inner">
                                <div className="mb-3 text-slate-400 flex items-center">
                                  <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                                  &gt; 실시간 종목 분석 스캐너 작동 중... <span className="animate-pulse ml-1">_</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-800">
                                  <span>&gt; 1단계 (기본 필터) 통과:</span>
                                  <span className="text-white">{stepCounts[1] || 0} 종목</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-800">
                                  <span>&gt; 2단계 (추세 필터) 통과:</span>
                                  <span className="text-white">{stepCounts[2] || 0} 종목</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-800">
                                  <span>&gt; 3단계 (눌림 필터) 통과:</span>
                                  <span className="text-white">{stepCounts[3] || 0} 종목</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-800">
                                  <span>&gt; 4단계 (반등 필터) 통과:</span>
                                  <span className="text-white">{stepCounts[4] || 0} 종목</span>
                                </div>
                                <div className="flex justify-between py-1.5 text-blue-400 font-bold mt-1">
                                  <span>&gt; 5단계 (최종 합격) 종목:</span>
                                  <span>{stepCounts[5] || 0} 종목</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <p className="text-slate-500 text-lg">
                        조건에 맞는 종목이 없습니다. 검색 조건을 조금 더 완화해 보세요.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {viewMode === 'news' && <NewsView />}
          {viewMode === 'watchlist' && <WatchlistView />}
        </div>
      </main>
    </div>
  );
}
