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

/** Browser: a download. Native app: a cache file handed to the system share sheet (save, mail, open in...). */
export async function saveFileNative(data: Blob, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    saveBlob(data, fileName);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: fileName, data: await toBase64(data), directory: Directory.Cache });
  try {
    await Share.share({ files: [uri], title: fileName });
  } catch (error) {
    // Closing the share sheet is not a failure.
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    throw error;
  }
}
