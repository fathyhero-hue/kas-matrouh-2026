"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";

export type IdCardData = CardRenderData;

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
    <div dir="rtl" className={`print-card-grid grid grid-cols-1 gap-5 justify-items-center ${className}`}>
      {(face === "front" || face === "both") && (
        <div data-card-face="front" className="id-card-print w-full max-w-[430px] overflow-hidden rounded-[22px] shadow-2xl">
          <div dangerouslySetInnerHTML={{ __html: renderCardSvg(data, "front", qrDataUrl) }} />
        </div>
      )}
      {(face === "back" || face === "both") && (
        <div data-card-face="back" className="id-card-print w-full max-w-[430px] overflow-hidden rounded-[22px] shadow-2xl">
          <div dangerouslySetInnerHTML={{ __html: renderCardSvg(data, "back", qrDataUrl) }} />
        </div>
      )}
    </div>
  );
}
