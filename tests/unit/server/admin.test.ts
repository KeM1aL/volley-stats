import { beforeEach, describe, expect, it, vi } from "vitest";

const { getReportCaller } = vi.hoisted(() => ({ getReportCaller: vi.fn() }));
vi.mock("@/lib/server/report-caller", () => ({ getReportCaller }));

import { requireAdmin } from "@/lib/server/admin";

/** A caller whose `profiles` read resolves to the given result; records the table and filter it was asked for. */
function callerReading(result: { data: unknown; error: unknown }) {
  const calls: { table?: string; column?: string; value?: string } = {};
  const query = {
    select: () => query,
    eq: (column: string, value: string) => {
      calls.column = column;
      calls.value = value;
      return query;
    },
    maybeSingle: () => Promise.resolve(result),
  };
  const caller = {
    userId: "user-1",
    supabase: { from: (table: string) => ((calls.table = table), query) },
  };
  return { caller, calls };
}

const request = new Request("http://localhost/api/import/ffvb", { method: "POST" });

describe("requireAdmin", () => {
  beforeEach(() => getReportCaller.mockReset());

  it("answers 401 without a signed-in caller", async () => {
    getReportCaller.mockResolvedValue(null);
    expect(await requireAdmin(request)).toEqual({ status: 401 });
  });

  it("answers 403 for a user whose role is user", async () => {
    const { caller, calls } = callerReading({ data: { role: "user" }, error: null });
    getReportCaller.mockResolvedValue(caller);
    expect(await requireAdmin(request)).toEqual({ status: 403 });
    expect(calls).toEqual({ table: "profiles", column: "id", value: "user-1" });
  });

  it("answers 403 when the role cannot be read", async () => {
    getReportCaller.mockResolvedValue(callerReading({ data: null, error: { message: "boom" } }).caller);
    expect(await requireAdmin(request)).toEqual({ status: 403 });
  });

  it("answers 403 when there is no profile row", async () => {
    getReportCaller.mockResolvedValue(callerReading({ data: null, error: null }).caller);
    expect(await requireAdmin(request)).toEqual({ status: 403 });
  });

  it("returns the caller for an admin", async () => {
    const { caller } = callerReading({ data: { role: "admin" }, error: null });
    getReportCaller.mockResolvedValue(caller);
    expect(await requireAdmin(request)).toEqual({ caller });
  });
});
