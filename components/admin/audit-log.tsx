"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch, buttonClass, dateText, inputClass } from "@/components/admin/management-client";
type AuditData = { total: number; pageSize: number; logs: { id: number; actor_user_id: string | null; actor_name: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; metadata: { changed_fields?: string[] } }[] };
export function AuditLog() {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminFetch<AuditData>(`/api/admin/audit?page=${page}&${filters}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [page, filters, revision]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of values) if (String(value).trim()) params.set(key, String(value).trim());
    setError(""); setData(null); setPage(1); setFilters(params.toString()); setRevision(v => v + 1);
  }
  function navigate(next: number) { setData(null); setError(""); setPage(next); }
  return <main dir="rtl" className="space-y-6"><h1 className="text-h1 font-black">سجل النشاط</h1><form onSubmit={filter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label>معرف المسؤول<input name="actor" placeholder="UUID" className={inputClass} /></label><label>نوع العملية<input name="action" placeholder="admins.create" className={inputClass} /></label><label>من تاريخ (UTC)<input type="date" name="from" className={inputClass} /></label><label>إلى تاريخ (UTC)<input type="date" name="to" className={inputClass} /></label><button className={buttonClass}>تطبيق الفلاتر</button></form>{error && <p role="alert" className="text-red-400">{error} <button onClick={() => { setError(""); setRevision(v => v + 1); }}>إعادة المحاولة</button></p>}{!data && !error && <p role="status">جاري تحميل السجل…</p>}{data && <><div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-white/10"><table className="w-full text-right text-sm"><thead><tr>{["المسؤول", "العملية", "نوع العنصر", "العنصر", "التاريخ والوقت", "التفاصيل"].map(t => <th scope="col" className="p-4" key={t}>{t}</th>)}</tr></thead><tbody>{data.logs.map(log => <tr key={log.id} className="border-t border-white/10"><td className="p-4">{log.actor_name}<small className="block text-xs text-muted-foreground">{log.actor_user_id}</small></td><td className="p-4">{log.action}</td><td className="p-4">{log.entity_type ?? "—"}</td><td className="p-4">{log.entity_id ?? "—"}</td><td className="p-4">{dateText(log.created_at)}</td><td className="p-4">{log.metadata.changed_fields?.join("، ") ?? "—"}</td></tr>)}</tbody></table>{!data.logs.length && <p className="p-6">لا توجد سجلات مطابقة.</p>}</div><div className="flex items-center justify-between"><button disabled={page === 1} className={buttonClass} onClick={() => navigate(page - 1)}>السابق</button><span>صفحة {page} من {Math.max(1, Math.ceil(data.total / data.pageSize))} — {data.total} عملية</span><button disabled={page * data.pageSize >= data.total} className={buttonClass} onClick={() => navigate(page + 1)}>التالي</button></div></>}</main>;
}
