import { appleAppSiteAssociation } from "@/lib/server/app-links";

export const dynamic = "force-dynamic";

export function GET() {
  const body = appleAppSiteAssociation({ APPLE_TEAM_ID: process.env.APPLE_TEAM_ID, IOS_BUNDLE_ID: process.env.IOS_BUNDLE_ID });
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Content-Type": "application/json" } });
}
