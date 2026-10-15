"use client";

import { useSearchParams } from "next/navigation";
import { parseRouteId } from "@/lib/routes";

/** The page's ?id=, or null when missing or not a UUID. Call under a <Suspense> boundary. */
export function useRouteId(): string | null {
  return parseRouteId(useSearchParams().get("id"));
}
