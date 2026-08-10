"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

const CARD_W = 95; // mm
const CARD_H = 55; // mm
const PAGE_W = 210;
const PAGE_H = 297;
const GAP = 2;
const COLS = 2; // col 0 = front, col 1 = back
const ROWS = 4; // 4 cards (8 faces) per page

export function PdfDownloadButton({ filename = "player-cards.pdf" }: { filename?: string }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    const fronts = Array.from(document.querySelectorAll<HTMLElement>('[data-card-face="front"]'));
    const backs = Array.from(document.querySelectorAll<HTMLElement>('[data-card-face="back"]'));
    if (fronts.length === 0) return;

    setLoading(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

      const gridW = CARD_W * COLS + GAP * (COLS - 1);
      const gridH = CARD_H * ROWS + GAP * (ROWS - 1);
      const marginX = Math.max(0, (PAGE_W - gridW) / 2);
      const marginY = Math.max(0, (PAGE_H - gridH) / 2);

      const doc = new jsPDF({ unit: "mm", format: "a4" });

      for (let i = 0; i < fronts.length; i++) {
        const cardsPerPage = ROWS;
        const posInPage = i % cardsPerPage;
        if (i !== 0 && posInPage === 0) doc.addPage();

        const row = posInPage;
        const y = marginY + row * (CARD_H + GAP);

        const frontDataUrl = await toPng(fronts[i], { pixelRatio: 2, cacheBust: true });
        doc.addImage(frontDataUrl, "PNG", marginX, y, CARD_W, CARD_H);

        if (backs[i]) {
          const backDataUrl = await toPng(backs[i], { pixelRatio: 2, cacheBust: true });
          doc.addImage(backDataUrl, "PNG", marginX + CARD_W + GAP, y, CARD_W, CARD_H);
        }
      }

      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert("تعذر تجهيز ملف PDF، حاول تاني.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={loading}
      className="print:hidden fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-accent-green px-5 py-3 text-body font-black text-background shadow-2xl disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      {loading ? "جاري التجهيز..." : "تنزيل PDF"}
    </button>
  );
}
