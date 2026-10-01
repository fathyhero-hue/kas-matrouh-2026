"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CARD_HEIGHT, CARD_WIDTH, renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";
import { getContainScale } from "@/lib/player-cards/layout";

export type IdCardData = CardRenderData;

function CardFace({ data, face, qrDataUrl }: { data: IdCardData; face: "front" | "back"; qrDataUrl: string }) {
  return (
    <div data-card-face={face} className="id-card-print w-full overflow-hidden rounded-[22px] shadow-[0_18px_45px_rgba(0,0,0,.32)] ring-1 ring-white/10">
      <div className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: renderCardSvg(data, face, qrDataUrl) }} />
    </div>
  );
}

export function IdCard({ data, className = "", face = "both" }: { data: IdCardData; className?: string; face?: "front" | "back" | "both" }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(data.qrPayload, { width: 160, margin: 0 })
      .then((value) => { if (!cancelled) setQrDataUrl(value); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [data.qrPayload]);

  return (
    <div dir="rtl" className={`print-card-grid grid w-full grid-cols-1 gap-5 justify-items-center ${className}`}>
      {(face === "front" || face === "both") && <CardFace data={data} face="front" qrDataUrl={qrDataUrl} />}
      {(face === "back" || face === "both") && <CardFace data={data} face="back" qrDataUrl={qrDataUrl} />}
    </div>
  );
}

export function CardPreviewStage({ data, face = "front", className = "" }: { data: IdCardData; face?: "front" | "back"; className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const availableWidth = Math.max(0, stageSize.width - 32);
  const availableHeight = Math.max(0, stageSize.height - 32);
  const scale = stageSize.width && stageSize.height
    ? getContainScale(availableWidth, availableHeight, CARD_WIDTH, CARD_HEIGHT)
    : 1;

  return (
    <div ref={stageRef} className={`flex min-h-[260px] h-[min(68vh,520px)] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0d1626] p-4 shadow-inner sm:p-6 ${className}`}>
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: "center center" }} className="shrink-0">
        <IdCard data={data} face={face} />
      </div>
    </div>
  );
}
