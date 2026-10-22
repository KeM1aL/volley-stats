// Literal process.env reads: Next inlines NEXT_PUBLIC_* values only when written out in full.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfig(): { url: string; anonKey: string } {
  if (!url || !anonKey) throw new Error("Missing Supabase environment variables");
  return { url, anonKey };
}
