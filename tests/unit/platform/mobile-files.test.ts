import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { saveBlob } from "@/lib/report/download";
import { saveFileNative } from "@/lib/platform/mobile/files";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: vi.fn() },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));
vi.mock("@/lib/report/download", () => ({ saveBlob: vi.fn() }));

const blob = new Blob(["hello"], { type: "text/plain" });

describe("saveFileNative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: "file:///cache/report.pdf" });
  });

  it("downloads in a browser", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    await saveFileNative(blob, "report.pdf");
    expect(saveBlob).toHaveBeenCalledWith(blob, "report.pdf");
    expect(Share.share).not.toHaveBeenCalled();
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it("writes to the cache folder and opens the share sheet", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockResolvedValue({ activityType: undefined });
    await saveFileNative(blob, "report.pdf");
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: "report.pdf",
      data: btoa("hello"),
      directory: Directory.Cache,
    });
    expect(Share.share).toHaveBeenCalledWith({ files: ["file:///cache/report.pdf"], title: "report.pdf" });
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it("treats a cancelled share as success", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockRejectedValue(new Error("Share canceled"));
    await expect(saveFileNative(blob, "report.pdf")).resolves.toBeUndefined();
  });

  it("rejects other share errors", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockRejectedValue(new Error("boom"));
    await expect(saveFileNative(blob, "report.pdf")).rejects.toThrow("boom");
  });
});
