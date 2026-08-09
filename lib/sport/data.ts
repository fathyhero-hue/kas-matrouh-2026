import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export async function getBracketIdBySuffix(suffix: string) {
  const supabase = createPublicClient();
  const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", suffix).maybeSingle();
  if (!bracket) notFound();
  return bracket.id as string;
}
