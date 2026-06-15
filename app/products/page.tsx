export const metadata = {
  title: "Products & Prices | Matrouh Sports",
  description: "Real products and prices for Matrouh Sports.",
};

const products = [
  {
    name: "اشتراك فى بطولة كأس النخبة",
    price: "1200 جنيه",
    description: "اشتراك في بطولة كرة قدم.",
  },
  {
    name: "اشتراك بطولة كأس مطروح",
    price: "1500 جنيه",
    description: "اشتراك في بطولة كرة قدم.",
  },
];

export default function ProductsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-5xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">Real Products & Real Prices</h1>
        <p className="mt-4 leading-8 text-slate-200">
          هذه هي المنتجات/الخدمات المتاحة حاليًا على منصة مطروح الرياضية، والأسعار الموضحة هي الأسعار الفعلية بالجنيه المصري.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {products.map((product) => (
            <article key={product.name} className="rounded-2xl border border-emerald-500/20 bg-[#13213a] p-5">
              <h2 className="text-xl font-black text-emerald-300">{product.name}</h2>
              <p className="mt-3 text-slate-300">{product.description}</p>
              <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-2xl font-black text-cyan-300">
                {product.price}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
