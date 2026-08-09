"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Edit, Trash2, Plus, Loader2 } from "lucide-react";

type Product = {
  id: string;
  title: string | null;
  price: number;
  category: string | null;
  description: string | null;
  stock: number | null;
  sort_order: number | null;
  is_active: boolean;
  image_url: string | null;
};

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

function emptyForm() {
  return { title: "", price: "", category: "", description: "", stock: "", sort_order: "0", is_active: true };
}

export function ShopProductsManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<any>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      title: p.title || "",
      price: String(p.price ?? ""),
      category: p.category || "",
      description: p.description || "",
      stock: p.stock === null || p.stock === undefined ? "" : String(p.stock),
      sort_order: String(p.sort_order ?? 0),
      is_active: p.is_active !== false,
      existing_image_url: p.image_url || "",
    });
    setImagePreview(p.image_url || "");
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm());
    setImageFile(null);
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error("اكتب اسم المنتج");
    setSaving(true);
    try {
      const fd = new FormData();
      if (editingId) fd.set("id", editingId);
      fd.set("title", form.title.trim());
      fd.set("price", form.price || "0");
      fd.set("category", form.category);
      fd.set("description", form.description);
      fd.set("stock", form.stock);
      fd.set("sort_order", form.sort_order || "0");
      fd.set("is_active", String(form.is_active));
      fd.set("existing_image_url", form.existing_image_url || "");
      if (imageFile) fd.set("image", imageFile);

      const res = await fetch("/api/admin/shop-products", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");

      if (editingId) {
        setProducts((prev) => prev.map((p) => (p.id === editingId ? data.product : p)));
        toast.success("تم تعديل المنتج");
      } else {
        setProducts((prev) => [...prev, data.product]);
        toast.success("تم إضافة المنتج");
      }
      reset();
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ المنتج");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      const res = await fetch("/api/admin/shop-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشلت العملية");
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
    } catch (e: any) {
      toast.error(e?.message || "فشلت العملية");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("متأكد من حذف هذا المنتج؟")) return;
    try {
      const res = await fetch(`/api/admin/shop-products?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("تم حذف المنتج");
    } catch (e: any) {
      toast.error(e?.message || "فشل حذف المنتج");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
        <h2 className="mb-4 text-h3 font-black">{editingId ? "تعديل منتج" : "إضافة منتج جديد"}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl bg-secondary">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }}
            />
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-lg bg-accent-orange/15 py-2 text-caption font-black text-accent-orange">
              رفع صورة
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اسم المنتج" className={inputCls} />
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="السعر بالجنيه" className={inputCls} />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="التصنيف" className={inputCls} />
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="الكمية (اتركها فارغة لو غير محددة)" className={inputCls} />
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="الترتيب" className={inputCls} />
            <select value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })} className={inputCls}>
              <option value="true">ظاهر في المتجر</option>
              <option value="false">مخفي مؤقتاً</option>
            </select>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر"
              className="h-20 rounded-lg bg-secondary px-3 py-2 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue sm:col-span-2"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={submit} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-caption font-black text-primary-foreground disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editingId ? "حفظ التعديل" : "إضافة المنتج"}
          </button>
          {editingId && (
            <button onClick={reset} className="rounded-xl bg-white/5 px-5 py-3 text-caption font-black text-muted-foreground">إلغاء</button>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-h3 font-black">منتجات المتجر ({products.length})</h2>
        {products.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد منتجات بعد</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className={`overflow-hidden rounded-2xl bg-card ring-1 ${p.is_active === false ? "opacity-60 ring-white/5" : "ring-white/10"}`}>
                <div className="relative h-28 bg-secondary">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🛍️</div>
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="truncate text-caption font-black">{p.title}</div>
                  <div className="text-[11px] font-black text-accent-orange">{Number(p.price || 0).toLocaleString("ar-EG")} ج.م</div>
                  <div className="flex gap-1.5">
                    <button onClick={() => startEdit(p)} className="flex-1 rounded-lg bg-accent-blue/15 py-1.5 text-[10px] font-black text-accent-blue">
                      <Edit className="mx-auto h-3 w-3" />
                    </button>
                    <button onClick={() => toggleActive(p)} className={`flex-1 rounded-lg py-1.5 text-[10px] font-black ${p.is_active === false ? "bg-accent-green/15 text-accent-green" : "bg-white/5 text-muted-foreground"}`}>
                      {p.is_active === false ? "إظهار" : "إخفاء"}
                    </button>
                    <button onClick={() => remove(p.id)} className="flex-1 rounded-lg bg-red-500/15 py-1.5 text-[10px] font-black text-red-400">
                      <Trash2 className="mx-auto h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
