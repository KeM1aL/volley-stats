import { getReportCaller, type ReportCaller } from "@/lib/server/report-caller";

/**
 * Gate for routes that only application admins may call: 401 without a signed-in caller, 403 unless
 * `profiles.role` is "admin" (also when the role cannot be read). The role is read with the caller's own
 * client, so RLS applies and a caller can only ever see their own row.
 */
export async function requireAdmin(request: Request): Promise<{ caller: ReportCaller } | { status: 401 | 403 }> {
  const caller = await getReportCaller(request);
  if (!caller) return { status: 401 };
  const { data, error } = await caller.supabase.from("profiles").select("role").eq("id", caller.userId).maybeSingle();
  if (error || data?.role !== "admin") return { status: 403 };
  return { caller };
}
