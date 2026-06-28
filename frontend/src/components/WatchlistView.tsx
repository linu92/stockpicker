"use client";

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import StockChart from "./StockChart";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export default function WatchlistView() {
  const { watchlist, isFetchingWatchlist, fetchWatchlist, removeFromWatchlist, selectStock, selectedStock } = useStore();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ buy_price: "", sell_price: "", youtube_link: "" });

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleEdit = (item: any) => {
    setEditingCode(item.stock_code);
    setEditForm({
      buy_price: item.buy_price || "",
      sell_price: item.sell_price || "",
      youtube_link: item.youtube_link || ""
    });
  };

  const handleSave = async (code: string, name: string) => {
    try {
      await axios.post(`${API_BASE}/api/watchlist`, {
        stock_code: code,
        stock_name: name,
        buy_price: editForm.buy_price ? parseInt(editForm.buy_price) : null,
        sell_price: editForm.sell_price ? parseInt(editForm.sell_price) : null,
        youtube_link: editForm.youtube_link || null
      });
      setEditingCode(null);
      fetchWatchlist();
    } catch (error) {
      console.error(error);
      alert("저장 실패");
    }
  };

  return (
    <div className="flex w-full h-full gap-4">
      <div className="w-1/2 bg-dark-panel border border-dark-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-800/50 border-b border-dark-border flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">⭐ 내 관심 종목</h3>
          <span className="text-xs bg-slate-700 px-2 py-1 rounded-full">{watchlist.length}개</span>
        </div>
        
        {isFetchingWatchlist ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {watchlist.map((item) => (
              <div 
                key={item.stock_code} 
                className={`bg-slate-800/40 border border-slate-700 rounded-xl p-4 transition-all ${selectedStock === item.stock_code ? 'ring-2 ring-yellow-500/50 bg-slate-800' : 'hover:bg-slate-800'}`}
                onClick={() => selectStock(item.stock_code)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white cursor-pointer hover:text-yellow-400">{item.stock_name} <span className="text-sm text-slate-500 font-normal">({item.stock_code})</span></h4>
                    <p className="text-xs text-slate-400 mt-1">등록일: {new Date(item.added_at).toLocaleDateString()} {item.added_price ? `| 등록 시점 주가: ${item.added_price.toLocaleString()}원` : ''}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.stock_code); }}
                    className="text-slate-500 hover:text-red-400 text-sm px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
                
                {editingCode === item.stock_code ? (
                  <div className="space-y-3 bg-slate-900/50 p-3 rounded-lg mt-2" onClick={e => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400">매수가</label>
                        <input type="number" value={editForm.buy_price} onChange={e => setEditForm({...editForm, buy_price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">목표 매도가</label>
                        <input type="number" value={editForm.sell_price} onChange={e => setEditForm({...editForm, sell_price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-sm text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">유튜브 분석 링크</label>
                      <input type="text" value={editForm.youtube_link} onChange={e => setEditForm({...editForm, youtube_link: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-sm text-white" />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingCode(null)} className="px-3 py-1 bg-slate-700 text-white rounded text-sm hover:bg-slate-600">취소</button>
                      <button onClick={() => handleSave(item.stock_code, item.stock_name)} className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500">저장</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 bg-slate-900/30 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm relative group cursor-pointer" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-blue-400">✏️ 수정</span>
                    </div>
                    <div>
                      <span className="text-slate-500">매수가: </span>
                      <span className="text-white">{item.buy_price ? `${item.buy_price.toLocaleString()}원` : '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">목표가: </span>
                      <span className="text-yellow-400">{item.sell_price ? `${item.sell_price.toLocaleString()}원` : '-'}</span>
                    </div>
                    {item.youtube_link && (
                      <div className="col-span-2 mt-1">
                        <a href={item.youtube_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          ▶️ 분석 영상 보기
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {watchlist.length === 0 && (
              <div className="text-center text-slate-500 py-10">
                관심 종목이 없습니다.<br/>검색기에서 종목을 추가해보세요.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-dark-panel border border-dark-border rounded-2xl shadow-xl overflow-hidden">
        {selectedStock ? (
          <StockChart />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            좌측 목록에서 종목을 선택하여 차트를 확인하세요.
          </div>
        )}
      </div>
    </div>
  );
}
