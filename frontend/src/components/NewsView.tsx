"use client";

import { useStore } from "@/store/useStore";
import { useEffect } from "react";
import { X } from "lucide-react";

export default function NewsView() {
  const { newsList, isFetchingNews, fetchNews, fetchNewsContent, selectedNewsHtml, setSelectedNewsHtml } = useStore();

  useEffect(() => {
    fetchNews();
  }, []);

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
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {newsList.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">수집된 기사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-dark-border">
                {newsList.map((news) => (
                  <li 
                    key={news.id} 
                    onClick={() => fetchNewsContent(news.url)}
                    className={`p-5 cursor-pointer hover:bg-slate-800 transition-colors ${news.is_read ? 'opacity-60' : 'font-bold'}`}
                  >
                    <div className="text-sm text-blue-400 mb-2">{news.source} | {news.published_date}</div>
                    <div className="text-white text-lg line-clamp-2">{news.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Overlay Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm z-10 transition-opacity duration-300 ${selectedNewsHtml ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setSelectedNewsHtml(null)}
      ></div>

      {/* Sliding Article Drawer (Right side) */}
      <div 
        className={`absolute top-0 right-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out z-20 ${
          selectedNewsHtml ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800">기사 본문</h3>
          <button 
            onClick={() => setSelectedNewsHtml(null)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white text-slate-900">
          {selectedNewsHtml ? (
            <div className="news-content-wrapper" dangerouslySetInnerHTML={{ __html: selectedNewsHtml }} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
