import { describe, expect, it } from "vitest";
import { decideDatabaseReset } from "@/lib/rxdb/reset-policy";

describe("decideDatabaseReset", () => {
  it("resets an incompatible database when asked and nothing is unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, force: false, unsentCount: 0 })).toBe("reset");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, force: false, unsentCount: 0 })).toBe("reset");
  });

  it("refuses to reset while changes are unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, force: false, unsentCount: 3 })).toBe("blocked");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, force: false, unsentCount: 1 })).toBe("blocked");
  });

  it("keeps the database for other errors or without a request", () => {
    expect(decideDatabaseReset({ isSchemaError: false, devEnvironment: true, removeFlag: true, force: false, unsentCount: 0 })).toBe("keep");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: false, force: false, unsentCount: 0 })).toBe("keep");
  });

  it("resets even with unsent changes when forced", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: false, force: true, unsentCount: 5 })).toBe("reset");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: true, force: true, unsentCount: 5 })).toBe("reset");
  });

  it("never resets a database that failed for another reason, even when forced", () => {
    expect(decideDatabaseReset({ isSchemaError: false, devEnvironment: false, removeFlag: false, force: true, unsentCount: 5 })).toBe("keep");
  });
});
