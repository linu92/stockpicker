"use client";

import { useStore } from "@/store/useStore";
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function NewsView() {
  const { 
    newsList, 
    isFetchingNews, 
    fetchNews, 
    fetchNewsContent, 
    selectedNewsHtml, 
    selectedNewsUrl 
  } = useStore();

  const expandedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  // When an article opens, scroll it into view slightly
  useEffect(() => {
    if (selectedNewsUrl && expandedRef.current) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [selectedNewsUrl]);

  return (
    <div className="flex w-full h-full relative overflow-hidden rounded-2xl">
      {/* News List Container */}
      <div className="w-full h-full bg-dark-panel border border-dark-border shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-800/50 border-b border-dark-border flex justify-between items-center">
          <h3 className="font-bold text-white">수집된 기사 목록</h3>
          <span className="text-xs text-slate-400">총 {newsList.length}건</span>
        </div>
        
        {isFetchingNews ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900">
            {newsList.length === 0 ? (
              <p className="p-8 text-slate-500 text-center">수집된 기사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-dark-border/50">
                {newsList.map((news) => {
                  const isExpanded = selectedNewsUrl === news.url;
                  
                  return (
                    <li 
                      key={news.id} 
                      ref={isExpanded ? expandedRef : null}
                      className={`transition-colors ${
                        isExpanded ? 'bg-slate-800/80 border-l-4 border-blue-500' : 'hover:bg-slate-800/40 border-l-4 border-transparent'
                      }`}
                    >
                      {/* Header (Clickable) */}
                      <div 
                        onClick={() => fetchNewsContent(news.url)}
                        className={`p-5 cursor-pointer flex justify-between items-start gap-4 ${news.is_read && !isExpanded ? 'opacity-60' : ''}`}
                      >
                        <div className="flex-1">
                          <div className="text-xs text-blue-400 mb-2 font-medium">{news.source} <span className="text-slate-500 mx-1">|</span> <span className="text-slate-400">{news.published_date}</span></div>
                          <div className={`text-lg transition-colors ${isExpanded ? 'text-blue-300 font-bold' : 'text-slate-200 font-medium'}`}>
                            {news.title}
                          </div>
                        </div>
                        <div className="mt-1 text-slate-500">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>

                      {/* Expandable Content Area */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 bg-white text-slate-900 rounded-b-lg mx-4 mb-4 overflow-hidden shadow-inner">
                          {selectedNewsHtml ? (
                            <div className="p-6 md:p-8 news-content-wrapper min-h-[200px]" dangerouslySetInnerHTML={{ __html: selectedNewsHtml }} />
                          ) : (
                            <div className="p-8 flex items-center justify-center text-slate-500 min-h-[200px]">
                              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
