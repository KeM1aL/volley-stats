import { describe, expect, it } from "vitest";
import { matchRemoval, removalError } from "@/lib/matches/removal";

describe("matchRemoval", () => {
  it("deletes an upcoming match", () => {
    expect(matchRemoval({ status: "upcoming" })).toBe("delete");
  });

  it("archives a live or completed match", () => {
    expect(matchRemoval({ status: "live" })).toBe("archive");
    expect(matchRemoval({ status: "completed" })).toBe("archive");
  });
});

describe("removalError", () => {
  it("maps the delete_unstarted_match errors", () => {
    expect(removalError({ code: "P0001", message: "match_started" })).toBe("started");
    expect(removalError({ code: "P0002", message: "match_not_found" })).toBe("notFound");
    expect(removalError({ code: "42501", message: "match_not_deleted" })).toBe("forbidden");
  });

  it("treats anything else as unknown", () => {
    expect(removalError(new Error("x"))).toBe("unknown");
    expect(removalError(null)).toBe("unknown");
    expect(removalError({ code: "23505" })).toBe("unknown");
  });
});
