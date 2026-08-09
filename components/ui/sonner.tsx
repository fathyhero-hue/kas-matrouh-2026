"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Themed wrapper around sonner, matching the brand palette in app/globals.css
// instead of sonner's default theme-detection (this product is single-theme).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      dir="rtl"
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--card-foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          fontWeight: 700,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
