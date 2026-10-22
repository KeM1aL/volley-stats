import type { NextRequest } from "next/server";
import { renderMatchReport } from "@/components/report-pdf/render";
import { checkReportAccess } from "@/lib/report/access";
import { buildMatchReport } from "@/lib/report/build";
import { preflight, withCors } from "@/lib/server/cors";
import { getReportCaller } from "@/lib/server/report-caller";
import { contentDisposition, isLocale, isUuid, REPORT_VERSION, reportEtag, reportFileName, resolveLocale } from "@/lib/report/http";
import { loadMatchReportData, ReportNotFoundError } from "@/lib/report/load";
import { rows } from "@/lib/report/query";

export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "private, no-store" };
const failure = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

async function handle(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  if (!isUuid(matchId)) return failure(404, "matchNotFound");
  const teamId = request.nextUrl.searchParams.get("team");
  if (!teamId) return failure(400, "missingTeam");

  try {
    const caller = await getReportCaller(request);
    if (!caller) return failure(401, "unauthorized");

    const access = await checkReportAccess(caller.supabase, caller.userId, matchId, teamId);
    if (access === "match-not-found") return failure(404, "matchNotFound");
    if (access === "team-not-in-match") return failure(400, "teamNotInMatch");
    if (access === "forbidden") return failure(403, "forbidden");

    const { data, lastModified } = await loadMatchReportData(caller.supabase, matchId);
    const requested = request.nextUrl.searchParams.get("locale");
    const profileLanguage = isLocale(requested)
      ? null
      : ((await rows(caller.supabase.from("profiles").select("language").eq("id", caller.userId)))[0]?.language ?? null);
    const locale = resolveLocale(requested, profileLanguage);

    const etag = reportEtag({ lastModified, locale, teamId, version: REPORT_VERSION });
    const headers = { ...NO_STORE, ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

    const pdf = await renderMatchReport(buildMatchReport(data, teamId), locale);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(reportFileName(data.homeTeam.name, data.awayTeam.name, data.match.date)),
      },
    });
  } catch (error) {
    if (error instanceof ReportNotFoundError) return failure(404, "matchNotFound");
    console.error("Match report failed:", error);
    return failure(500, "reportFailed");
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withCors(request, await handle(request, context));
}

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}
