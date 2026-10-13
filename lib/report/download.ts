/** File name from a Content-Disposition header, preferring the UTF-8 form. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Malformed: fall back to the plain name.
    }
  }
  return header.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

/** Saves a blob as a download in the browser. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
