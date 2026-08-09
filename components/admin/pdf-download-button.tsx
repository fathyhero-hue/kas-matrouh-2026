"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

const CARD_ASPECT = 1.586; // matches IdCard's aspect-[1.586/1]
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
const GAP = 5;
const COLS = 2;
const ROWS = 2;

export function PdfDownloadButton({ filename = "player-cards.pdf" }: { filename?: string }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-print-card]"));
    if (cards.length === 0) return;

    setLoading(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

      const cardW = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
      const cardH = cardW / CARD_ASPECT;
      const gridH = cardH * ROWS + GAP * (ROWS - 1);
      const offsetY = MARGIN + Math.max(0, (PAGE_H - MARGIN * 2 - gridH) / 2);

      const doc = new jsPDF({ unit: "mm", format: "a4" });

      for (let i = 0; i < cards.length; i++) {
        const posInPage = i % (COLS * ROWS);
        if (i !== 0 && posInPage === 0) doc.addPage();

        const col = posInPage % COLS;
        const row = Math.floor(posInPage / COLS);
        const x = MARGIN + col * (cardW + GAP);
        const y = offsetY + row * (cardH + GAP);

        const dataUrl = await toPng(cards[i], { pixelRatio: 2, cacheBust: true });
        doc.addImage(dataUrl, "PNG", x, y, cardW, cardH);
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
