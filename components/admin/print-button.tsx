"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-body font-black text-primary-foreground shadow-2xl"
    >
      <Printer className="h-5 w-5" />
      طباعة / حفظ كـ PDF
    </button>
  );
}
