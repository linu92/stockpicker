"use client";

import { useStore } from "@/store/useStore";
import { useEffect } from "react";

export default function NewsView() {
  const { newsList, isFetchingNews, fetchNews, fetchNewsContent, selectedNewsHtml } = useStore();

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="flex w-full h-full gap-4">
      <div className="w-1/3 bg-dark-panel border border-dark-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-800/50 border-b border-dark-border">
          <h3 className="font-bold text-white">수집된 기사 목록</h3>
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
                    className={`p-4 cursor-pointer hover:bg-slate-800 transition-colors ${news.is_read ? 'opacity-60' : 'font-bold'}`}
                  >
                    <div className="text-sm text-blue-400 mb-1">{news.source} | {news.published_date}</div>
                    <div className="text-white line-clamp-2">{news.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-dark-panel border border-dark-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {selectedNewsHtml ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6" dangerouslySetInnerHTML={{ __html: selectedNewsHtml }} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            좌측 목록에서 기사를 선택하세요.
          </div>
        )}
      </div>
    </div>
  );
}
