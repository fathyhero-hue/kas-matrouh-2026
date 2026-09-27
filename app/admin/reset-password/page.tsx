"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { buttonClass, inputClass } from "@/components/admin/management-client";
import Link from "next/link";

function recoveryClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { isSingleton: false, auth: { detectSessionInUrl: false } });
}
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const initialization = useRef<Promise<void> | null>(null);
  useEffect(() => {
    // Recovery email originates on the server without a browser PKCE verifier.
    // Consume the implicit recovery fragment, never persist it in UI/logs/history.
    let cancelled = false;
    async function initialize() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access = hash.get("access_token");
      const refresh = hash.get("refresh_token");
      const recovery = hash.get("type") === "recovery";
      window.history.replaceState(null, "", "/admin/reset-password");
      if (!recovery || !access || !refresh) throw new Error("الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.");
      const client = recoveryClient();
      const result = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (result.error) throw new Error("الرابط غير صالح أو انتهت صلاحيته.");
    }
    initialization.current ??= initialize();
    initialization.current.then(() => { if (!cancelled) setReady(true); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password"));
    if (password !== values.get("confirm")) { setError("كلمتا المرور غير متطابقتين."); return; }
    setBusy(true); setError("");
    try {
      const client = recoveryClient();
      const result = await client.auth.updateUser({ password });
      if (result.error) throw new Error("تعذر تغيير كلمة المرور. تحقق من متطلباتها أو اطلب رابطًا جديدًا.");
      form.reset();
      await client.auth.signOut();
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تغيير كلمة المرور."); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl font-bold">إعادة تعيين كلمة المرور</h1>{error && <p role="alert" className="text-red-400">{error}</p>}{done ? <p>تم تغيير كلمة المرور. <Link href="/admin/login" className="underline">تسجيل الدخول</Link></p> : ready ? <form className="space-y-4" onSubmit={submit}><label className="block">كلمة مرور جديدة<input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label className="block">تأكيد كلمة المرور<input className={inputClass} name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><button className={buttonClass} disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ كلمة المرور"}</button></form> : !error && <p>جاري التحقق من الرابط…</p>}</main>;
}
