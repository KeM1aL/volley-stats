import { assetLinks } from "@/lib/server/app-links";

export const dynamic = "force-dynamic";

export function GET() {
  const body = assetLinks({ ANDROID_PACKAGE: process.env.ANDROID_PACKAGE, ANDROID_CERT_SHA256: process.env.ANDROID_CERT_SHA256 });
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Content-Type": "application/json" } });
}
