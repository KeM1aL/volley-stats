import { beforeEach, describe, expect, it, vi } from "vitest";
import { Preferences } from "@capacitor/preferences";
import { createPreferencesStorage } from "@/lib/platform/mobile/storage";

vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

describe("createPreferencesStorage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads, writes and removes through Preferences", async () => {
    const storage = createPreferencesStorage();
    await storage.setItem("sb-token", "v");
    expect(Preferences.set).toHaveBeenCalledWith({ key: "sb-token", value: "v" });

    vi.mocked(Preferences.get).mockResolvedValueOnce({ value: null });
    expect(await storage.getItem("missing")).toBeNull();

    vi.mocked(Preferences.get).mockResolvedValueOnce({ value: "v" });
    expect(await storage.getItem("sb-token")).toBe("v");
    expect(Preferences.get).toHaveBeenLastCalledWith({ key: "sb-token" });

    await storage.removeItem("sb-token");
    expect(Preferences.remove).toHaveBeenCalledWith({ key: "sb-token" });
  });
});
