import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebPlatform, deviceLabelFromUserAgent, generateDeviceId } from "@/lib/rxdb/sync/platform/web";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("deviceLabelFromUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Chrome · Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iPhone"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iPad"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0", "Edge · Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Linux"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Safari · macOS"],
  ])("labels %s", (userAgent, label) => {
    expect(deviceLabelFromUserAgent(userAgent)).toBe(label);
  });
});

describe("generateDeviceId", () => {
  it("uses crypto.randomUUID when it exists", () => {
    expect(generateDeviceId({ randomUUID: () => "10000000-0000-4000-8000-000000000000" } as any)).toBe(
      "10000000-0000-4000-8000-000000000000"
    );
  });

  it("builds a v4 id from getRandomValues outside secure contexts (no randomUUID)", () => {
    const id = generateDeviceId({ getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) } as any);
    expect(id).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("falls back to Math.random without any crypto, and ids differ", () => {
    const a = generateDeviceId(undefined);
    const b = generateDeviceId({} as any);
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});

describe("web platform getDeviceId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never throws when crypto.randomUUID is missing (http://<LAN-IP>), and keeps the id", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const platform = createWebPlatform();
    const id = await platform.getDeviceId();
    expect(id).toMatch(UUID_V4);
    expect(await platform.getDeviceId()).toBe(id);
  });

  it("never throws when neither storage nor crypto.randomUUID is available", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    vi.stubGlobal("crypto", {});
    await expect(createWebPlatform().getDeviceId()).resolves.toMatch(UUID_V4);
  });
});
