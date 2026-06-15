export const metadata = {
  title: "About Us | Matrouh Sports",
  description: "About Matrouh Sports platform.",
};

export default function AboutPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">About Us — من نحن</h1>
        <p className="mt-5 leading-8 text-slate-200">
          مطروح الرياضية هي منصة رياضية إلكترونية متخصصة في عرض أخبار البطولات، جداول المباريات، النتائج، الإحصائيات، وترتيب الفرق، مع توفير خدمات الاشتراك في بطولات كرة القدم المنظمة من خلال المنصة.
        </p>
        <p className="mt-4 leading-8 text-slate-200">
          نعمل على تقديم تجربة واضحة وسهلة للفرق والجمهور، تشمل متابعة البطولات، معرفة مواعيد المباريات، الاطلاع على النتائج، والتواصل مع إدارة البطولة عند الحاجة.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <h2 className="text-xl font-black text-emerald-300">Business Information</h2>
          <div className="mt-3 space-y-2 text-slate-200" dir="ltr">
            <p><strong>Website/App:</strong> Matrouh Sports</p>
            <p><strong>Email:</strong> fathyhero@gmail.com</p>
            <p><strong>Phone:</strong> 01222264993</p>
            <p><strong>Address:</strong> Matrouh, Egypt</p>
          </div>
        </div>
      </section>
    </main>
  );
}
