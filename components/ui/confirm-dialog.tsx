"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";

// Replaces window.confirm() across the app with a themed, non-blocking modal.
// Usage: const ok = await confirmAction({ title: "...", description: "..." });
type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

let resolver: ((value: boolean) => void) | null = null;
const listeners = new Set<(opts: ConfirmOptions | null) => void>();
let currentOptions: ConfirmOptions | null = null;

function setOptions(opts: ConfirmOptions | null) {
  currentOptions = opts;
  listeners.forEach((l) => l(opts));
}

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = resolve;
    setOptions(opts);
  });
}

function respond(value: boolean) {
  resolver?.(value);
  resolver = null;
  setOptions(null);
}

export function ConfirmDialogHost() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);

  React.useEffect(() => {
    listeners.add(setOpts);
    return () => {
      listeners.delete(setOpts);
    };
  }, []);

  return (
    <AlertDialog.Root open={!!opts} onOpenChange={(open) => !open && respond(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" />
        <AlertDialog.Content
          dir="rtl"
          className="fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-white/10"
        >
          <AlertDialog.Title className="text-lg font-black">{opts?.title}</AlertDialog.Title>
          {opts?.description && (
            <AlertDialog.Description className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">
              {opts.description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex gap-3">
            <AlertDialog.Cancel asChild>
              <button
                onClick={() => respond(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                {opts?.cancelLabel || "إلغاء"}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={() => respond(true)}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition-colors",
                  opts?.destructive ? "bg-destructive text-white hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
                )}
              >
                {opts?.confirmLabel || "تأكيد"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
