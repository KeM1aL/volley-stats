import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { webNative } from "../web/native";
import type { ShareLinkResult } from "../types";

/** Native app: the system share sheet with the link. Browser (static export without the app shell): like web. */
export async function shareLinkNative(link: { url: string; title: string; text?: string }): Promise<ShareLinkResult> {
  if (!Capacitor.isNativePlatform()) return webNative.shareLink(link);
  try {
    await Share.share({ url: link.url, title: link.title });
    return "shared";
  } catch (error) {
    // Closing the share sheet is not a failure.
    if (error instanceof Error && /cancel/i.test(error.message)) return "cancelled";
    throw error;
  }
}
