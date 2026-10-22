import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { shareLinkNative } from "@/lib/platform/mobile/share";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));

const link = { url: "https://app.example/matches/stats?id=m1", title: "Match Statistics" };

describe("shareLinkNative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the system share sheet with the link in the app", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockResolvedValue({ activityType: undefined });
    await expect(shareLinkNative(link)).resolves.toBe("shared");
    expect(Share.share).toHaveBeenCalledWith({ url: link.url, title: link.title });
  });

  it("reports a closed share sheet as cancelled", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockRejectedValue(new Error("Share canceled"));
    await expect(shareLinkNative(link)).resolves.toBe("cancelled");
  });

  it("rejects other share errors", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockRejectedValue(new Error("boom"));
    await expect(shareLinkNative(link)).rejects.toThrow("boom");
  });

  it("copies the link in a browser without the Web Share API", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(shareLinkNative(link)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(link.url);
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("uses the Web Share API in a browser that has it", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await expect(shareLinkNative(link)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: link.title, url: link.url });
    expect(Share.share).not.toHaveBeenCalled();
  });
});
