"use client";

import { useStore } from "@/store/useStore";
import { Search, Newspaper, Star } from "lucide-react";

export default function BottomTaskbar() {
  const { viewMode, setViewMode } = useStore();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-2xl">
      <button
        onClick={() => setViewMode('search')}
        className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group ${
          viewMode === 'search' 
            ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title="종목 검색기"
      >
        <Search size={22} className={`transition-transform duration-300 ${viewMode === 'search' ? 'scale-110' : 'group-hover:scale-110'}`} />
        {viewMode === 'search' && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
        )}
      </button>

      <button
        onClick={() => setViewMode('news')}
        className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group ${
          viewMode === 'news' 
            ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title="기사보기 모드"
      >
        <Newspaper size={22} className={`transition-transform duration-300 ${viewMode === 'news' ? 'scale-110' : 'group-hover:scale-110'}`} />
        {viewMode === 'news' && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
        )}
      </button>

      <button
        onClick={() => setViewMode('watchlist')}
        className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group ${
          viewMode === 'watchlist' 
            ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title="관심 종목 모드"
      >
        <Star size={22} className={`transition-transform duration-300 ${viewMode === 'watchlist' ? 'scale-110 text-yellow-300' : 'group-hover:scale-110'}`} />
        {viewMode === 'watchlist' && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
        )}
      </button>
    </div>
  );
}
