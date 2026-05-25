"use client";
import React from "react";

export default function SponsorMarquee() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@keyframes infinite-scroll-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(50%); } } .sponsor-track { display: flex; width: max-content; animation: infinite-scroll-rtl 40s linear infinite; } .sponsor-track:hover { animation-play-state: paused; }`}} />
      <div className="mb-6 bg-[#13213a] py-3 rounded-2xl border border-yellow-400/20 overflow-hidden relative shadow-sm" dir="rtl">
        <div className="sponsor-track items-center gap-10">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-10">
              <span className="text-yellow-400/60 font-bold tracking-widest text-[10px] px-2 border-l border-white/10 uppercase">شركاء النجاح</span>
              {[ 
                { name: "الفهد للديكور", src: "/alfahd.png" }, 
                { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, 
                { name: "دثار للزي العربي", src: "/dithar.png" }, 
                { name: "معصرة فرجينيا", src: "/virginia.png" }, 
                { name: "دبي للزي العربي", src: "/dubai.png" }, 
                { name: "معرض الأمانة", src: "/alamana.png" }, 
                { name: "تراث البادية", src: "/torath.png" }, 
                { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, 
                { name: "مياة حياة", src: "/hayah.png" }, 
                { name: "القدس للأثاث", src: "/alquds.png" }, 
                { name: "أيس كريم الملكة", src: "/almaleka.png" }, 
                { name: "جزارة عبدالله الجراري", src: "/aljarari.png" }, 
                { name: "M MART", src: "/mmart.png" }, 
                { name: "هيرو سبورت", src: "/hero-sport.png" }, 
                { name: "الفتح للفراشة", src: "/alfath.png" }, 
                { name: "عادل العميري للديكور", src: "/alomairy.png" }
              ].map((sponsor, idx) => (
                <img key={idx} src={sponsor.src} alt={sponsor.name} title={sponsor.name} className="h-10 w-24 object-contain drop-shadow-sm transition-transform hover:scale-110 cursor-pointer" onError={(e) => (e.currentTarget.style.display = 'none')} loading="lazy" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}