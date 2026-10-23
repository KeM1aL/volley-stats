import { describe, expect, it } from "vitest";
import { INITIAL_ALL_SAVED_TRACKER, trackAllSaved } from "@/lib/rxdb/sync/all-saved";
import type { SyncBadgeState } from "@/lib/rxdb/sync/status";

function run(states: (SyncBadgeState | null)[]): boolean[] {
  let tracker = INITIAL_ALL_SAVED_TRACKER;
  return states.map((state) => {
    const result = trackAllSaved(tracker, state);
    tracker = result.tracker;
    return result.toast;
  });
}

describe("trackAllSaved", () => {
  it("toasts once when the queue empties after waiting offline", () =>
    expect(run(["saved", "waiting", "uploading", "saved", "saved"])).toEqual([false, false, false, true, false]));
  it("toasts when waiting goes straight to saved", () => expect(run(["saved", "waiting", "saved"])).toEqual([false, false, true]));
  it("does not toast for an upload that never waited", () => expect(run(["saved", "uploading", "saved"])).toEqual([false, false, false]));
  it("does not toast for the first state, even when saved", () => expect(run(["saved"])).toEqual([false]));
  it("ignores a null state (status not computed yet)", () => expect(run([null, "waiting", null, "saved"])).toEqual([false, false, false, true]));
  it("keeps the wait across a problem state", () => expect(run(["waiting", "problem", "saved"])).toEqual([false, false, true]));
  it("toasts again for a second wait", () =>
    expect(run(["saved", "waiting", "saved", "waiting", "saved"])).toEqual([false, false, true, false, true]));
});
