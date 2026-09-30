"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadCardsPdf } from "@/lib/player-cards/export";
import type { IdCardData } from "@/components/player-card/id-card";

export function PdfDownloadButton({ cards, filename = "player-cards.pdf" }: { cards: IdCardData[]; filename?: string }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (cards.length === 0) return;
    setLoading(true);
    try {
      await downloadCardsPdf(cards, filename);
    } catch (error) {
      console.error("[player-cards] bulk export failed", error instanceof Error ? error.message : "unknown");
      toast.error("تعذر تجهيز ملف PDF. تأكد من اتصال الصور وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={loading || cards.length === 0}
      className="print:hidden fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-accent-green px-5 py-3 text-body font-black text-background shadow-2xl disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      {loading ? "جاري التجهيز..." : `تنزيل PDF (${cards.length})`}
    </button>
  );
}
