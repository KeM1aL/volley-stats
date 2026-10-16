import { describe, expect, it } from "vitest";
import { buildDecisions, parseDeleteAccountError, teamsToDecide, type TeamToDecide } from "@/lib/auth/delete-account";

const ME = "user-me";
const member = (team_id: string, user_id: string | null, name: string, extra: { archived_at?: string | null; _deleted?: boolean } = {}) => ({
  team_id,
  user_id,
  name,
  archived_at: extra.archived_at ?? null,
  _deleted: extra._deleted ?? false,
});

describe("teamsToDecide", () => {
  it("keeps only members with an account, not archived, not deleted, not the user", () => {
    const result = teamsToDecide(
      [{ id: "t1", name: "Alpha" }],
      [
        member("t1", ME, "Me"),
        member("t1", null, "Unlinked"),
        member("t1", "u-archived", "Archived", { archived_at: "2026-01-01T00:00:00Z" }),
        member("t1", "u-deleted", "Deleted", { _deleted: true }),
        member("t1", "u-ok", "Okay"),
      ],
      ME
    );
    expect(result).toEqual([{ team: { id: "t1", name: "Alpha" }, candidates: [{ userId: "u-ok", name: "Okay" }] }]);
  });

  it("keeps one candidate per user even with two rows in the team", () => {
    const result = teamsToDecide([{ id: "t1", name: "Alpha" }], [member("t1", "u1", "Bea"), member("t1", "u1", "Bea again")], ME);
    expect(result[0].candidates).toHaveLength(1);
    expect(result[0].candidates[0].userId).toBe("u1");
  });

  it("ignores members of other teams", () => {
    const result = teamsToDecide([{ id: "t1", name: "Alpha" }], [member("t2", "u1", "Bea")], ME);
    expect(result[0].candidates).toEqual([]);
  });

  it("sorts teams and candidates by name", () => {
    const result = teamsToDecide(
      [
        { id: "t2", name: "Zulu" },
        { id: "t1", name: "Alpha" },
      ],
      [member("t1", "u2", "Zoe"), member("t1", "u1", "Adam")],
      ME
    );
    expect(result.map((r) => r.team.name)).toEqual(["Alpha", "Zulu"]);
    expect(result[0].candidates.map((c) => c.name)).toEqual(["Adam", "Zoe"]);
  });

  it("gives a team without candidate an empty list", () => {
    expect(teamsToDecide([{ id: "t1", name: "Alpha" }], [], ME)).toEqual([{ team: { id: "t1", name: "Alpha" }, candidates: [] }]);
  });
});

describe("buildDecisions", () => {
  const teams: TeamToDecide[] = [
    { team: { id: "t1", name: "Alpha" }, candidates: [{ userId: "u1", name: "Bea" }] },
    { team: { id: "t2", name: "Beta" }, candidates: [] },
  ];

  it("is null while a team has no choice", () => {
    expect(buildDecisions(teams, { t1: { action: "delete" } })).toBeNull();
    expect(buildDecisions(teams, { t1: { action: "delete" }, t2: undefined })).toBeNull();
  });

  it("maps delete and transfer", () => {
    expect(buildDecisions(teams, { t1: { action: "transfer", newOwner: "u1" }, t2: { action: "delete" } })).toEqual([
      { team_id: "t1", action: "transfer", new_owner: "u1" },
      { team_id: "t2", action: "delete", new_owner: null },
    ]);
  });

  it("is an empty list for a user with no teams", () => {
    expect(buildDecisions([], {})).toEqual([]);
  });
});

describe("parseDeleteAccountError", () => {
  it("is ok without an error", () => {
    expect(parseDeleteAccountError(null)).toEqual({ ok: true });
  });

  it("recognises the two decision errors", () => {
    expect(parseDeleteAccountError({ message: "invalid_decisions" })).toMatchObject({ ok: false, reason: "invalid_decisions" });
    expect(parseDeleteAccountError({ message: "invalid_new_owner" })).toMatchObject({ ok: false, reason: "invalid_new_owner" });
  });

  it("treats anything else as failed and keeps the message", () => {
    expect(parseDeleteAccountError({ message: "boom" })).toEqual({ ok: false, reason: "failed", message: "boom" });
    expect(parseDeleteAccountError({})).toMatchObject({ ok: false, reason: "failed" });
  });
});
