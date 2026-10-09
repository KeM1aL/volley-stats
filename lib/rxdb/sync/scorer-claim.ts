import type { SupabaseClient } from "@supabase/supabase-js";

/** Who scores a match (server columns `scorer_*`, spec section 7). */
export interface ScorerInfo {
  deviceId: string | null;
  userId: string | null;
  name: string | null;
  deviceLabel: string | null;
  claimedAt: string | null;
  lastActivityAt: string | null;
}

export interface ClaimResult {
  claimed: boolean;
  holder: ScorerInfo;
}

export class ScorerRpcError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ScorerRpcError";
  }
}

/**
 * The server answered and refused the claim: `P0002` (the match doesn't exist for this user, e.g.
 * no UPDATE right) or `42501`. Not a network failure (status 0) nor a lost session (401): those
 * fall back to the offline prompt.
 */
export function isClaimForbidden(error: unknown): boolean {
  return (
    error instanceof ScorerRpcError &&
    error.status !== 0 &&
    error.status !== 401 &&
    (error.code === "P0002" || error.code === "42501")
  );
}

type ScorerRow = {
  claimed?: boolean;
  scorer_device_id: string | null;
  scorer_user_id: string | null;
  scorer_name: string | null;
  scorer_device_label: string | null;
  scorer_claimed_at: string | null;
  last_activity_at: string | null;
};

function toScorerInfo(row: ScorerRow): ScorerInfo {
  return {
    deviceId: row.scorer_device_id ?? null,
    userId: row.scorer_user_id ?? null,
    name: row.scorer_name ?? null,
    deviceLabel: row.scorer_device_label ?? null,
    claimedAt: row.scorer_claimed_at ?? null,
    lastActivityAt: row.last_activity_at ?? null,
  };
}

async function callScorerRpc(
  client: SupabaseClient<any>,
  name: "claim_match_scorer" | "get_match_scorer",
  params: Record<string, unknown>,
  deviceId: string
): Promise<ScorerRow> {
  const { data, error, status } = await client.rpc(name, params).setHeader("x-device-id", deviceId);
  if (error) throw new ScorerRpcError(error.code ?? "", error.message, status);
  if (!data) throw new ScorerRpcError("P0002", "match_not_found", status);
  return data as ScorerRow;
}

export async function claimMatchScorer(
  client: SupabaseClient<any>,
  args: { matchId: string; deviceId: string; label: string; force: boolean }
): Promise<ClaimResult> {
  const row = await callScorerRpc(
    client,
    "claim_match_scorer",
    { p_match_id: args.matchId, p_device_id: args.deviceId, p_label: args.label, p_force: args.force },
    args.deviceId
  );
  return { claimed: row.claimed === true, holder: toScorerInfo(row) };
}

export async function getMatchScorer(client: SupabaseClient<any>, matchId: string, deviceId: string): Promise<ScorerInfo> {
  return toScorerInfo(await callScorerRpc(client, "get_match_scorer", { p_match_id: matchId }, deviceId));
}
