"use client";
import React from "react";

export default function MainHero() {
  return (
    <div className="mb-6 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 text-center shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat"></div>
      <div className="flex justify-center mb-6 relative z-10">
        <img src="/logo.png" alt="شعار مطروح الرياضية" className="h-20 sm:h-28 lg:h-32 w-auto max-w-[90%] object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
      </div>
      <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight relative z-10">مطروح الرياضية</h1>
      <p className="mt-3 text-xl text-cyan-300 font-bold relative z-10">المنصة الرياضية الأولى بمحافظة مطروح</p>
    </div>
  );
}