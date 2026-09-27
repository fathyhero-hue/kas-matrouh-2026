import Link from "next/link";
export default function ForbiddenPage() { return <main dir="rtl" className="p-10"><h1>لا تملك صلاحية عرض هذا القسم.</h1><Link href="/admin">العودة إلى لوحة التحكم</Link></main>; }
