import { GoogleAnalytics } from "@next/third-parties/google";

/** Web build only (the mobile platform has no analytics): NEXT_PUBLIC_* is inlined only when written out in full. */
export function WebAnalytics() {
  if (process.env.NODE_ENV === "development" || !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return null;
  return <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />;
}
