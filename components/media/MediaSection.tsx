"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MediaSectionProps {
  mediaItems: any[];
  mediaSubTab: "news" | "videos";
  setMediaSubTab: (tab: "news" | "videos") => void;
  getYoutubeId: (url: string) => string | null;
}

export default function MediaSection({ mediaItems, mediaSubTab, setMediaSubTab, getYoutubeId }: MediaSectionProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-center mb-4">
        <div className="bg-[#1e2a4a] p-1 border border-white/5 rounded-xl flex gap-1">
          <button 
            onClick={() => setMediaSubTab("news")} 
            className={`text-sm px-4 py-2 rounded-lg font-bold ${mediaSubTab === 'news' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}
          >
            📰 الأخبار والمقالات
          </button>
          <button 
            onClick={() => setMediaSubTab("videos")} 
            className={`text-sm px-4 py-2 rounded-lg font-bold ${mediaSubTab === 'videos' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}
          >
            🎥 استوديو الأهداف والملخصات
          </button>
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
                ) : <div className="w-full aspect-video bg-[#0a1428] flex items-center justify-center text-4xl">🎥</div>}
                <h3 className="text-base font-black text-white leading-tight px-1">{video.title}</h3>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}