import { createApi } from "@/lib/api";
import { importFfvbMatches } from "@/lib/importers/ffvb";
import { createClient } from "@/lib/supabase/server";
import { create } from "lodash";


import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { seasonId, championshipId } = await request.json();

  if (!seasonId || !championshipId) {
    return NextResponse.json({ error: "Missing seasonId or championshipId" }, { status: 400 });
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
