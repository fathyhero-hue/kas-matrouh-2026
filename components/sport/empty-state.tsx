export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card p-10 text-center ring-1 ring-white/10">
      <p className="text-h3 font-black text-muted-foreground">{message}</p>
      {hint && <p className="mt-2 text-body text-muted-foreground">{hint}</p>}
    </div>
  );
}
