export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "تعذر تنفيذ الطلب.");
  return data as T;
}
export const jsonRequest = (method: string, body?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const inputClass = "w-full rounded-xl border border-white/15 bg-card px-3 py-2";
export const buttonClass = "rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50";
export const dateText = (value: string | null) => value ? new Date(value).toLocaleString("ar-EG") : "—";
