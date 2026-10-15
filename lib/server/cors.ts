/** CORS for /api/v1: the static export (another origin) calls the web deployment with a Bearer token, no cookies. */
const METHODS = "GET, POST, DELETE, OPTIONS";
const HEADERS = "Authorization, Content-Type, If-None-Match";
const EXPOSED = "ETag, Content-Disposition";

export function allowedOrigins(value: string | undefined = process.env.API_CORS_ORIGINS): string[] {
  return (value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function corsHeaders(origin: string | null, allowed: string[] = allowedOrigins()): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": METHODS,
    "Access-Control-Allow-Headers": HEADERS,
    "Access-Control-Expose-Headers": EXPOSED,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function withCors(request: Request, response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders(request.headers.get("origin")))) response.headers.set(name, value);
  return response;
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}
