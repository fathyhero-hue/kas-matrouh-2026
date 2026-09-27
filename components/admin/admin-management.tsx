"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch, buttonClass, dateText, inputClass, jsonRequest } from "@/components/admin/management-client";

type Admin = { user_id: string; display_name: string; email: string | null; role_key: string; is_active: boolean; created_at: string; last_sign_in_at: string | null };
type Role = { key: string; name: string };
type Listing = { admins: Admin[]; roles: Role[]; viewer: { userId: string; role: string; permissions: string[] } };
type Detail = { admin: Admin; roles: Role[]; permissions: { key: string; name: string }[]; overrides: { permission_key: string; effect: string }[]; effectivePermissions: string[]; baseline: string[] };
const domains: Record<string, string> = { dashboard: "لوحة التحكم", matches: "المباريات", stats: "الإحصائيات", rosters: "القوائم", registrations: "التسجيلات", teams: "الفرق", tournaments: "البطولات", content: "المحتوى", notifications: "الإشعارات", shop: "المتجر", admins: "المسؤولون", audit: "سجل النشاط", settings: "الإعدادات" };

export function AdminManagement() {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminFetch<Listing>("/api/admin/admins", { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [revision]);
  const can = (permission: string) => data?.viewer.role === "super_admin" && data.viewer.permissions.includes(permission);
  const refresh = () => { setError(""); setRevision(v => v + 1); window.dispatchEvent(new Event("admin-permissions-changed")); };
  const filtered = data?.admins.filter(a => `${a.display_name} ${a.email ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (!role || a.role_key === role) && (!status || a.is_active === (status === "active"))) ?? [];
  return <main dir="rtl" className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-h1 font-black">إدارة المسؤولين</h1><p className="text-muted-foreground">الحسابات والأدوار والصلاحيات</p></div>{can("admins.create") && <button className={buttonClass} onClick={() => { setCreating(true); setSelected(null); }}>إضافة مسؤول</button>}</div>
    {error && <p role="alert" className="text-red-400">{error} <button onClick={refresh}>إعادة المحاولة</button></p>}
    {notice && <p role="status" className="text-green-400">{notice}</p>}
    {!data && !error && <p role="status">جاري تحميل المسؤولين…</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3"><label>بحث<input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="الاسم أو البريد" /></label><label>الدور<select className={inputClass} value={role} onChange={e => setRole(e.target.value)}><option value="">كل الأدوار</option>{data.roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label><label>الحالة<select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">كل الحالات</option><option value="active">نشط</option><option value="inactive">معطل</option></select></label></div>
      {creating && <CreateAdmin roles={data.roles} close={() => setCreating(false)} saved={() => { setCreating(false); setNotice("تم إنشاء المسؤول."); refresh(); }} />}
      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-white/10"><table className="w-full text-right text-sm"><thead><tr>{["المسؤول", "البريد الإلكتروني", "الدور", "الحالة", "آخر تسجيل دخول", "إنشاء الحساب", "الإجراءات"].map(title => <th scope="col" className="p-4" key={title}>{title}</th>)}</tr></thead><tbody>{filtered.map(a => <tr className="border-t border-white/10" key={a.user_id}><td className="p-4 font-bold">{a.display_name}</td><td className="p-4" dir="ltr">{a.email ?? "—"}</td><td className="p-4">{data.roles.find(r => r.key === a.role_key)?.name ?? a.role_key}</td><td className="p-4">{a.is_active ? "نشط" : "معطل"}</td><td className="p-4">{dateText(a.last_sign_in_at)}</td><td className="p-4">{dateText(a.created_at)}</td><td className="p-4"><button className="underline" onClick={() => { setSelected(a.user_id); setCreating(false); }}>التفاصيل</button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-6">لا توجد نتائج.</p>}</div>
      {selected && <AdminDetail key={selected} userId={selected} can={can} close={() => setSelected(null)} saved={refresh} />}
    </>}
  </main>;
}

function CreateAdmin({ roles, saved, close }: { roles: Role[]; saved: () => void; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError("");
    try {
      await adminFetch("/api/admin/admins", jsonRequest("POST", { display_name: values.get("display_name"), email: values.get("email"), password: values.get("password"), role_key: values.get("role_key"), is_active: values.get("is_active") === "on" }));
      form.reset(); saved();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الإنشاء."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-white/15 p-5" aria-label="إضافة مسؤول"><h2 className="mb-4 text-xl font-bold">إضافة مسؤول</h2><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label>الاسم<input autoFocus name="display_name" required maxLength={100} className={inputClass} /></label><label>البريد الإلكتروني<input name="email" type="email" required maxLength={254} className={inputClass} dir="ltr" /></label><label>كلمة مرور أولية<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={inputClass} dir="ltr" /><span className="text-xs text-muted-foreground">12 حرفًا على الأقل</span></label><label>الدور<select name="role_key" defaultValue="viewer" className={inputClass}>{roles.map(r => <option value={r.key} key={r.key}>{r.name}</option>)}</select></label><label><input name="is_active" type="checkbox" defaultChecked /> حساب نشط</label>{error && <p role="alert" className="text-red-400">{error}</p>}<div className="flex gap-3"><button disabled={busy} className={buttonClass}>{busy ? "جاري الإنشاء…" : "إنشاء المسؤول"}</button><button type="button" disabled={busy} onClick={close}>إلغاء</button></div></form></section>;
}

function AdminDetail({ userId, can, close, saved }: { userId: string; can: (p: string) => boolean | undefined; close: () => void; saved: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    adminFetch<Detail>(`/api/admin/admins/${userId}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [userId]);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      await adminFetch(`/api/admin/admins/${userId}${path}`, jsonRequest(method, body));
      setMessage(path === "/password-reset" ? "تم إرسال رابط إعادة تعيين كلمة المرور." : "تم حفظ التغيير.");
      saved();
      setData(await adminFetch<Detail>(`/api/admin/admins/${userId}`));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ التغيير."); }
    finally { setBusy(false); }
  }
  function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void mutate("", "PATCH", { display_name: values.get("display_name"), role_key: values.get("role_key") });
  }
  return <section aria-label="تفاصيل المسؤول" className="space-y-5 rounded-2xl border border-white/15 p-5">
    <div className="flex justify-between"><h2 className="text-xl font-bold">تفاصيل المسؤول {data?.admin.display_name}</h2><button onClick={close} disabled={busy}>إغلاق</button></div>
    {error && <p role="alert" className="text-red-400">{error}</p>}{message && <p role="status" className="text-green-400">{message}</p>}
    {!data && !error && <p>جاري تحميل التفاصيل…</p>}
    {data && <>
      <p dir="ltr" className="text-right">{data.admin.email}</p>
      {can("admins.edit") && <form key={`${data.admin.display_name}-${data.admin.role_key}`} onSubmit={edit} className="grid gap-3 sm:grid-cols-3"><label>الاسم<input name="display_name" defaultValue={data.admin.display_name} required maxLength={100} className={inputClass} /></label><label>الدور<select name="role_key" defaultValue={data.admin.role_key} className={inputClass}>{data.roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label><button className={buttonClass} disabled={busy}>حفظ البيانات والدور</button></form>}
      <div className="flex flex-wrap gap-3">{can("admins.disable") && <button className={buttonClass} disabled={busy} onClick={() => { if (!data.admin.is_active || window.confirm(`تأكيد تعطيل ${data.admin.display_name}؟ سيتم منع طلباته الإدارية التالية.`)) void mutate("", "PATCH", { is_active: !data.admin.is_active }); }}>{data.admin.is_active ? "تعطيل المسؤول" : "تفعيل المسؤول"}</button>}{can("admins.reset_password") && <button className={buttonClass} disabled={busy} onClick={() => void mutate("/password-reset", "POST")}>إرسال رابط إعادة تعيين كلمة المرور</button>}</div>
      <h3 className="text-lg font-bold">الصلاحيات ({data.permissions.length})</h3>{!data.admin.is_active && <p>الحساب معطل؛ لا يمكنه تنفيذ طلبات إدارية حتى عند السماح بالصلاحية.</p>}
      {Object.entries(domains).map(([domain, name]) => <fieldset className="rounded-xl border border-white/10 p-3" key={domain}><legend className="px-2 font-bold">{name}</legend><div className="space-y-3">{data.permissions.filter(p => p.key.split(".")[0] === domain).map(p => {
        const override = data.overrides.find(o => o.permission_key === p.key)?.effect ?? "inherit";
        const allowed = data.effectivePermissions.includes(p.key);
        return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3" key={p.key}><div><p>{p.name}</p><code className="text-xs text-muted-foreground">{p.key}</code><p className={allowed ? "text-green-400" : "text-red-400"}>{allowed ? `✓ مسموح — ${override === "allow" ? "تخصيص" : "من الدور"}` : override === "deny" ? "✕ ممنوع — تخصيص" : "✕ غير موجودة في الدور"}</p></div>{can("admins.permissions.manage") && <select aria-label={`تخصيص ${p.name}`} className={`${inputClass} max-w-56`} disabled={busy} value={override} onChange={e => void mutate("/permissions", "PATCH", { permission_key: p.key, effect: e.target.value })}><option value="inherit">موروثة من الدور</option><option value="allow">سماح خاص</option><option value="deny">منع خاص</option></select>}</div>;
      })}</div></fieldset>)}
    </>}
  </section>;
}
