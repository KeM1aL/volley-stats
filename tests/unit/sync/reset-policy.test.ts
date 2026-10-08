import { describe, expect, it } from "vitest";
import { decideDatabaseReset } from "@/lib/rxdb/reset-policy";

describe("decideDatabaseReset", () => {
  it("resets an incompatible database when asked and nothing is unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, unsentCount: 0 })).toBe("reset");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, unsentCount: 0 })).toBe("reset");
  });

  it("refuses to reset while changes are unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, unsentCount: 3 })).toBe("blocked");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, unsentCount: 1 })).toBe("blocked");
  });

  it("keeps the database for other errors or without a request", () => {
    expect(decideDatabaseReset({ isSchemaError: false, devEnvironment: true, removeFlag: true, unsentCount: 0 })).toBe("keep");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: false, unsentCount: 0 })).toBe("keep");
  });
});
