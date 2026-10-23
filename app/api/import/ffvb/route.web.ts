import { createApi } from "@/lib/api";
import { importFfvbMatches } from "@/lib/importers/ffvb";
import { requireAdmin } from "@/lib/server/admin";
import { createClient } from "@/lib/server/supabase";
import { createTranslator } from "next-intl";
import messages from "@/messages/en";

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // The import runs with service-role rights below, so only an application admin may start it.
  const access = await requireAdmin(request);
  if ("status" in access) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
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
