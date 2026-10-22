import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { saveBlob } from "@/lib/report/download";

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // In chunks: String.fromCharCode(...bytes) overflows the call stack on large files.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

/**
 * A file name that is safe to write in the cache folder: report names are built from team names, which may hold "/" ("U15/U17":
 * the parent folder would not exist) or "../". Separators and control characters become "-", leading dots go (no "..", no hidden
 * file), and an empty result becomes "report.pdf".
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/\u0000-\u001f\u007f]/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return cleaned || "report.pdf";
}

/** Browser: a download. Native app: a cache file handed to the system share sheet (save, mail, open in...). */
export async function saveFileNative(data: Blob, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    saveBlob(data, fileName);
    return;
  }
  const safeName = safeFileName(fileName);
  const { uri } = await Filesystem.writeFile({ path: safeName, data: await toBase64(data), directory: Directory.Cache });
  try {
    await Share.share({ files: [uri], title: safeName });
  } catch (error) {
    // Closing the share sheet is not a failure.
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    throw error;
  }
}
