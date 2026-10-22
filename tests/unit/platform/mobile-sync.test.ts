import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { createNativeSyncPlatform } from "@/lib/platform/mobile/sync";

vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));
vi.mock("@capacitor/network", () => ({ Network: { getStatus: vi.fn(), addListener: vi.fn() } }));
vi.mock("@capacitor/device", () => ({ Device: { getInfo: vi.fn() } }));
vi.mock("@capacitor/preferences", () => ({ Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

type Listener = (event: never) => void;
const listeners = new Map<string, Listener>();
const remove = vi.fn(async () => {});

function captureListeners() {
  const capture = async (name: string, listener: Listener) => {
    listeners.set(name, listener);
    return { remove };
  };
  vi.mocked(Network.addListener).mockImplementation(capture as never);
  vi.mocked(App.addListener).mockImplementation(capture as never);
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createNativeSyncPlatform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    captureListeners();
    vi.mocked(Device.getInfo).mockResolvedValue({ model: "Pixel", operatingSystem: "android" } as never);
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });
    vi.mocked(Preferences.set).mockResolvedValue();
  });

  it("emits the current network status, then changes, without repeats", async () => {
    vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: "wifi" });
    const seen: boolean[] = [];
    const subscription = createNativeSyncPlatform().connectivity$.subscribe((value) => seen.push(value));
    await flush();
    const change = listeners.get("networkStatusChange")!;
    change({ connected: false, connectionType: "none" } as never);
    change({ connected: false, connectionType: "none" } as never);
    change({ connected: true, connectionType: "wifi" } as never);
    expect(seen).toEqual([true, false, true]);
    subscription.unsubscribe();
    await flush();
    expect(remove).toHaveBeenCalled();
  });

  it("emits foreground only when the app becomes active", async () => {
    const platform = createNativeSyncPlatform();
    let count = 0;
    const subscription = platform.foreground$.subscribe(() => count++);
    await flush();
    const change = listeners.get("appStateChange")!;
    change({ isActive: false } as never);
    expect(count).toBe(0);
    change({ isActive: true } as never);
    expect(count).toBe(1);
    subscription.unsubscribe();
    await flush();
    expect(remove).toHaveBeenCalled();
  });

  it("generates the device id once and keeps it", async () => {
    const platform = createNativeSyncPlatform();
    const [first, second] = await Promise.all([platform.getDeviceId(), platform.getDeviceId()]);
    expect(second).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Preferences.set).toHaveBeenCalledTimes(1);
    expect(Preferences.set).toHaveBeenCalledWith({ key: "volleystats:device-id", value: first });
    expect(await platform.getDeviceId()).toBe(first);
    expect(Preferences.set).toHaveBeenCalledTimes(1);
  });

  it("returns the id already stored", async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: "stored-id" });
    expect(await createNativeSyncPlatform().getDeviceId()).toBe("stored-id");
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("labels the device from Device.getInfo", async () => {
    vi.mocked(Device.getInfo).mockResolvedValue({ model: "iPad14,1", operatingSystem: "ios" } as never);
    const platform = createNativeSyncPlatform();
    await flush();
    expect(platform.getDeviceLabel()).toBe("iPad14,1 · iOS");
    expect(Device.getInfo).toHaveBeenCalledTimes(1);
  });

  it("labels Android devices", async () => {
    const platform = createNativeSyncPlatform();
    await flush();
    expect(platform.getDeviceLabel()).toBe("Pixel · Android");
  });
});
