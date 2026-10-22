import { afterEach, describe, expect, it, vi } from "vitest";
import { webNative } from "@/lib/platform/web/native";

const link = { url: "https://app.example/matches/stats?id=m1", title: "Match Statistics", text: "Check it out" };

describe("webNative.shareLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Web Share API with title, text and url", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await expect(webNative.shareLink(link)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: link.title, text: link.text, url: link.url });
  });

  it("reports a dismissed share dialog (AbortError) as cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Share canceled", "AbortError"));
    vi.stubGlobal("navigator", { share });
    await expect(webNative.shareLink(link)).resolves.toBe("cancelled");
  });

  it("rejects other Web Share errors", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new Error("boom")) });
    await expect(webNative.shareLink(link)).rejects.toThrow("boom");
  });

  it("copies the link without the Web Share API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(webNative.shareLink(link)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(link.url);
  });
});
