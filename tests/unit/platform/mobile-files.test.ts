import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { saveBlob } from "@/lib/report/download";
import { safeFileName, saveFileNative } from "@/lib/platform/mobile/files";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: vi.fn() },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));
vi.mock("@/lib/report/download", () => ({ saveBlob: vi.fn() }));

describe("safeFileName", () => {
  it("keeps an ordinary name", () => expect(safeFileName("Report U15 - Lions.pdf")).toBe("Report U15 - Lions.pdf"));
  it("replaces a slash", () => expect(safeFileName("U15/U17 - Lions.pdf")).toBe("U15-U17 - Lions.pdf"));
  it("replaces a backslash", () => expect(safeFileName("U15\\U17.pdf")).toBe("U15-U17.pdf"));
  it("cannot leave the cache folder", () => {
    expect(safeFileName("../x.pdf")).toBe("-x.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("-..-etc-passwd");
    expect(safeFileName("..")).toBe("report.pdf");
  });
  it("replaces control characters", () => expect(safeFileName("a\u0000b\nc\u007fd.pdf")).toBe("a-b-c-d.pdf"));
  it("strips leading dots", () => expect(safeFileName("...hidden.pdf")).toBe("hidden.pdf"));
  it("falls back when nothing is left", () => {
    expect(safeFileName("")).toBe("report.pdf");
    expect(safeFileName("   ")).toBe("report.pdf");
    expect(safeFileName("...")).toBe("report.pdf");
  });
});

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

  it("writes and shares a sanitised name", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockResolvedValue({ activityType: undefined });
    await saveFileNative(blob, "U15/U17 - Lions.pdf");
    expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: "U15-U17 - Lions.pdf" }));
    expect(Share.share).toHaveBeenCalledWith({ files: ["file:///cache/report.pdf"], title: "U15-U17 - Lions.pdf" });
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
