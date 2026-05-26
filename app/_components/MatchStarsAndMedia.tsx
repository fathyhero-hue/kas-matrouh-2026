"use client";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface MatchStarsAndMediaProps {
  activeTab: string;
  searchMotm: string;
  setSearchMotm: (val: string) => void;
  motmList: any[];
  mediaSubTab: "news" | "videos";
  setMediaSubTab: (tab: "news" | "videos") => void;
  mediaItems: any[];
  getYoutubeId: (url: string) => string | null;
}

export const MatchStarsAndMedia = ({
  activeTab,
  searchMotm,
  setSearchMotm,
  motmList,
  mediaSubTab,
  setMediaSubTab,
  mediaItems,
  getYoutubeId
}: MatchStarsAndMediaProps) => {
  return (
    <div className="animate-in fade-in duration-500">
      
      {/* 1. تبويب نجوم المباريات (MOTM) */}
      {activeTab === "motm_tab" && (
        <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] p-4 sm:p-6">
          <CardHeader className="pb-4 border-b border-white/10 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle className="text-yellow-300 font-black">🌟 سجل لوحة شرف نجوم اللقاءات (Man Of The Match)</CardTitle>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
              <Input value={searchMotm} onChange={e => setSearchMotm(e.target.value)} placeholder="بحث باسم النجم..." className="pr-10 bg-[#1e2a4a] border-yellow-400/40 text-white" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {motmList.filter(m => !searchMotm || String(m.player).toLowerCase().includes(searchMotm.trim().toLowerCase())).map((m, idx) => (
              <div key={idx} className="bg-gradient-to-b from-[#1e2a4a] to-[#0a1428] border border-yellow-400/30 rounded-2xl overflow-hidden p-4 flex gap-4 items-center shadow-lg relative group transition-transform hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-full bg-[#0a1428] border-2 border-yellow-400 overflow-hidden shrink-0 flex items-center justify-center">
                  {m.imageUrl ? <img src={m.imageUrl} className="w-full h-full object-cover" alt="MOTM"/> : <span className="text-2xl">👤</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-white text-base truncate">{m.player}</h4>
                  <span className="text-yellow-400 text-xs font-bold block mt-0.5 truncate">{m.team}</span>
                  <p className="text-[10px] text-gray-400 mt-2 truncate">مباراة: {m.matchName}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 2. تبويب أخبار البطولة واستوديو الميديا */}
      {activeTab === "media" && (
        <div className="space-y-6">
          <div className="flex justify-center mb-4">
            <div className="bg-[#1e2a4a] p-1 border border-white/5 rounded-xl flex gap-1">
              <button onClick={() => setMediaSubTab("news")} className={`text-sm px-4 py-2 rounded-lg font-bold ${mediaSubTab === 'news' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>📰 الأخبار والمقالات</button>
              <button onClick={() => setMediaSubTab("videos")} className={`text-sm px-4 py-2 rounded-lg font-bold ${mediaSubTab === 'videos' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>🎥 استوديو الأهداف والملخصات</button>
            </div>
          </div>
          
          {mediaSubTab === "news" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mediaItems.filter(item => item.type === "news").map(news => (
                <Card key={news.id} className="bg-[#13213a] border border-white/5 rounded-3xl overflow-hidden shadow-md">
                  {news.imageUrl && <div className="w-full aspect-video bg-[#0a1428] overflow-hidden"><img src={news.imageUrl} className="w-full h-full object-cover" alt="News"/></div>}
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-lg font-black text-white leading-snug">{news.title}</h3>
                    <p className="text-gray-300 text-sm font-bold leading-relaxed line-clamp-3">{news.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {mediaItems.filter(item => item.type === "video").map(video => {
                const ytId = getYoutubeId(video.url);
                return (
                  <Card key={video.id} className="bg-[#13213a] border border-white/5 rounded-3xl overflow-hidden p-4 shadow-xl space-y-4">
                    {ytId ? (
                      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/5 shadow-inner">
                        <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full border-none" allowFullScreen title={video.title} />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-[#0a1428] flex items-center justify-center text-4xl">🎥</div>
                    )}
                    <h3 className="text-base font-black text-white leading-tight px-1">{video.title}</h3>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};