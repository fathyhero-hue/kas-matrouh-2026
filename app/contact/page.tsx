export const metadata = {
  title: "Contact Us | Matrouh Sports",
  description: "Contact information for Matrouh Sports.",
};

export default function ContactPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">Contact Us — تواصل معنا</h1>
        <p className="mt-5 leading-8 text-slate-200">
          يمكنك التواصل معنا لأي استفسار متعلق بالبطولات، الاشتراكات، المدفوعات، أو الدعم الفني من خلال البيانات التالية.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3" dir="ltr">
          <a href="mailto:fathyhero@gmail.com" className="rounded-2xl border border-cyan-500/20 bg-[#13213a] p-5 text-center hover:border-cyan-400">
            <div className="text-sm text-slate-400">Email</div>
            <div className="mt-2 font-black text-cyan-300">fathyhero@gmail.com</div>
          </a>
          <a href="tel:+201222264993" className="rounded-2xl border border-cyan-500/20 bg-[#13213a] p-5 text-center hover:border-cyan-400">
            <div className="text-sm text-slate-400">Phone</div>
            <div className="mt-2 font-black text-cyan-300">01222264993</div>
          </a>
          <div className="rounded-2xl border border-cyan-500/20 bg-[#13213a] p-5 text-center">
            <div className="text-sm text-slate-400">Address</div>
            <div className="mt-2 font-black text-cyan-300">Matrouh, Egypt</div>
          </div>
        </div>
      </section>
    </main>
  );
}
