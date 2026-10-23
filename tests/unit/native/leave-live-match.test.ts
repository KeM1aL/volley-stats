import { beforeEach, describe, expect, it, vi } from "vitest";
import { allowNextUnload } from "@/hooks/use-unsent-guard";
import { leaveLiveMatch } from "@/components/native/leave-live-match";

vi.mock("@/hooks/use-unsent-guard", () => ({ allowNextUnload: vi.fn() }));

const router = { back: vi.fn(), replace: vi.fn() };

describe("leaveLiveMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing on stay", () => {
    leaveLiveMatch(router, "stay", true);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(allowNextUnload).not.toHaveBeenCalled();
  });
  it("goes back after leave, skipping the unload prompt once", () => {
    leaveLiveMatch(router, "leave", true);
    expect(allowNextUnload).toHaveBeenCalledOnce();
    expect(router.back).toHaveBeenCalledOnce();
  });
  it("goes to Matches after leave when there is nothing behind", () => {
    leaveLiveMatch(router, "leave", false);
    expect(allowNextUnload).toHaveBeenCalledOnce();
    expect(router.replace).toHaveBeenCalledWith("/matches");
    expect(router.back).not.toHaveBeenCalled();
  });
  it("goes back or to Matches when no guard was active, without touching the unload prompt", () => {
    leaveLiveMatch(router, "free", true);
    expect(router.back).toHaveBeenCalledOnce();
    leaveLiveMatch(router, "free", false);
    expect(router.replace).toHaveBeenCalledWith("/matches");
    expect(allowNextUnload).not.toHaveBeenCalled();
  });
});
