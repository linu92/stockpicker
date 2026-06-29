"use client";

import { useStore } from "@/store/useStore";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, X, Filter, Star } from "lucide-react";

export default function NewsView() {
  const { 
    newsList, 
    isFetchingNews, 
    fetchNews, 
    fetchNewsContent, 
    selectedNewsHtml, 
    selectedNewsUrl,
    toggleNewsStar
  } = useStore();

  const expandedRef = useRef<HTMLLIElement>(null);
  
  // Local filtering state
  const [hideRead, setHideRead] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [filterInput, setFilterInput] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = filterInput.trim();
      if (newTag && !filterTags.includes(newTag)) {
        setFilterTags([...filterTags, newTag]);
      }
      setFilterInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFilterTags(filterTags.filter(tag => tag !== tagToRemove));
  };

  const filteredNewsList = newsList.filter(news => {
    if (showStarredOnly && !news.is_starred) return false;
    
    // Do not hide the currently expanded article
    if (hideRead && news.is_read && news.url !== selectedNewsUrl) return false;
    
    if (filterTags.length > 0) {
      const textToSearch = `${news.title} ${news.source} ${news.summary || ''}`.toLowerCase();
      // Match if ANY of the tags are in the text
      const hasMatch = filterTags.some(tag => textToSearch.includes(tag.toLowerCase()));
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <div className="flex w-full h-full relative overflow-hidden rounded-2xl">
      {/* News List Container */}
      <div className="w-full h-full bg-dark-panel border border-dark-border shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-800/50 border-b border-dark-border flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white">수집된 기사 목록</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-yellow-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={showStarredOnly}
                  onChange={(e) => setShowStarredOnly(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500 cursor-pointer"
                />
                <Star size={14} className={showStarredOnly ? "fill-yellow-500 text-yellow-500" : ""} />
                별표 기사만
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={hideRead}
                  onChange={(e) => setHideRead(e.target.checked)}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
                읽은 기사 숨기기
              </label>
              <span className="text-xs text-slate-400">총 {filteredNewsList.length}건</span>
            </div>
          </div>
          
          {/* Tag Filter Input */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-2 rounded-lg focus-within:border-blue-500 transition-colors">
            <Filter size={16} className="text-slate-500 ml-2" />
            <div className="flex flex-wrap gap-2 items-center flex-1">
              {filterTags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-md border border-blue-800/50">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={12} /></button>
                </span>
              ))}
              <input
                type="text"
                value={filterInput}
                onChange={e => setFilterInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={filterTags.length === 0 ? "검색 필터 키워드 입력 후 Enter..." : "키워드 추가..."}
                className="bg-transparent border-none outline-none text-sm text-white min-w-[150px] flex-1 p-1"
              />
            </div>
          </div>
        </div>
        
        {isFetchingNews ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900">
            {filteredNewsList.length === 0 ? (
              <p className="p-8 text-slate-500 text-center">조건에 맞는 기사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-dark-border/50">
                {filteredNewsList.map((news) => {
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
                      <div className={`p-5 flex justify-between items-start gap-4 ${news.is_read && !isExpanded ? 'opacity-60' : ''}`}>
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => fetchNewsContent(news.url)}
                        >
                          <div className="text-xs text-blue-400 mb-2 font-medium">{news.source} <span className="text-slate-500 mx-1">|</span> <span className="text-slate-400">{news.published_date}</span></div>
                          <div className={`text-lg transition-colors ${isExpanded ? 'text-blue-300 font-bold' : 'text-slate-200 font-medium'}`}>
                            {news.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNewsStar(news.url, !news.is_starred);
                            }}
                            className="text-slate-500 hover:text-yellow-400 transition-colors"
                          >
                            <Star size={20} className={news.is_starred ? "fill-yellow-500 text-yellow-500" : ""} />
                          </button>
                          <div 
                            className="text-slate-500 cursor-pointer"
                            onClick={() => fetchNewsContent(news.url)}
                          >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Content Area */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 bg-slate-900 rounded-b-lg mx-4 mb-4 overflow-hidden shadow-inner">
                          {selectedNewsHtml ? (
                            <div className="news-content-wrapper min-h-[200px]" dangerouslySetInnerHTML={{ __html: selectedNewsHtml }} />
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
