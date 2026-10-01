"use client";

import { useState } from "react";
import { getA4CardRect, getCutGuideRect, type A4CardRect } from "@/lib/player-cards/layout";

type PrintPage = {
  faces: Array<{ front: string; back: string }>;
};

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

function faceStyle(rect: A4CardRect) {
  return {
    left: percent(rect.x, 210),
    top: percent(rect.y, 297),
    width: percent(rect.width, 210),
    height: percent(rect.height, 297),
  };
}

function Guide({ rect }: { rect: A4CardRect }) {
  const guide = getCutGuideRect(rect);
  return <div className="cut-guide" style={{ left: percent(guide.x, 210), top: percent(guide.y, 297), width: percent(guide.width, 210), height: percent(guide.height, 297) }} aria-hidden="true" />;
}

export function PlayerCardsPrintPreview({ pages, cardCount }: { pages: PrintPage[]; cardCount: number }) {
  const [showCutGuides, setShowCutGuides] = useState(true);

  return (
    <>
      <div className="screen-only mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-caption text-gray-600">
          <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
            <input type="checkbox" checked={showCutGuides} onChange={(event) => setShowCutGuides(event.target.checked)} />
            علامات القص
          </label>
          <span>الحجم الفعلي 100% وليس ملاءمة للصفحة</span>
        </div>
        <p className="text-caption font-bold text-gray-600">A4: 21×29.7 سم · البطاقة: 9×5 سم · {cardCount} بطاقة · {pages.length} صفحات</p>
      </div>

      <div className="player-card-sheets">
        {pages.map((page, pageIndex) => (
          <section key={pageIndex} className="sheet-frame" aria-label={`A4 page ${pageIndex + 1}`}>
            <div className="a4-sheet">
              {page.faces.map((face, playerIndex) => {
                const frontRect = getA4CardRect(playerIndex, "front");
                const backRect = getA4CardRect(playerIndex, "back");
                return (
                  <div key={playerIndex}>
                    <div className="card-face" style={faceStyle(frontRect)} dangerouslySetInnerHTML={{ __html: face.front }} />
                    <div className="card-face" style={faceStyle(backRect)} dangerouslySetInnerHTML={{ __html: face.back }} />
                    {showCutGuides && <><Guide rect={frontRect} /><Guide rect={backRect} /></>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <style jsx global>{`
        @page { size: A4 portrait; margin: 0; }
        .player-card-sheets { display: grid; gap: 20px; justify-items: center; }
        .sheet-frame { position: relative; width: min(210mm, calc(100vw - 24px)); aspect-ratio: 210 / 297; background: #fff; box-shadow: 0 12px 40px rgba(15,23,42,.16); }
        .a4-sheet { position: absolute; inset: 0; overflow: hidden; background: #fff; }
        .card-face { position: absolute; overflow: hidden; }
        .card-face > svg { display: block; width: 100%; height: 100%; }
        .cut-guide { position: absolute; border: .1mm dashed rgba(100,116,139,.7); pointer-events: none; }
        @media print {
          .screen-only { display: none !important; }
          .player-card-sheets { display: block; }
          .sheet-frame { width: 210mm; height: 297mm; margin: 0; box-shadow: none; break-after: page; }
          .sheet-frame:last-child { break-after: auto; }
        }
      `}</style>
    </>
  );
}
