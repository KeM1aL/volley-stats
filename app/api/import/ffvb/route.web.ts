import { createApi } from "@/lib/api";
import { importFfvbMatches } from "@/lib/importers/ffvb";
import { getReportCaller } from "@/lib/server/report-caller";
import { createClient } from "@/lib/server/supabase";
import { create } from "lodash";
import { createTranslator } from "next-intl";
import messages from "@/messages/en";

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // The import runs with service-role rights below, so only a signed-in caller may start it.
  if (!(await getReportCaller(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { seasonId, championshipId } = await request.json();
  const t = createTranslator({ locale: "en", messages, namespace: "common" });

  if (!seasonId || !championshipId) {
    return NextResponse.json({ error: t("errors.api.missingSeasonOrChampionship") }, { status: 400 });
  }

  try {
    const supabaseAdmin = await createClient();
    const backendApi = createApi(supabaseAdmin as any);
    await importFfvbMatches(seasonId, championshipId, backendApi);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
