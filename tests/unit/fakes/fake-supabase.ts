import { isoToMicros } from "@/lib/rxdb/sync/timestamps";

export type Row = Record<string, any>;
export interface FakeError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}
export interface FakeResponse {
  data: any;
  error: FakeError | null;
  status: number;
}
export interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
}
export interface FakeServerOptions {
  /** Column names per table (local schema properties + server-only columns). */
  tables: Record<string, string[]>;
  foreignKeys?: ForeignKey[];
  /** Tables guarded by the scorer trigger (besides `matches`). */
  scorerTables?: string[];
}
export interface ClientContext {
  online?: () => boolean;
  userId?: string;
  userName?: string | null;
}
export type Fault = "network" | "timeout" | "jwt-expired" | "server-error";
export interface LoggedRequest {
  table: string;
  op: string;
  headers: Record<string, string>;
  ids: string[];
  status: number;
  code: string | null;
}

type Filter = (row: Row) => boolean;

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null) ? 0 : Number.NaN;
  }
  const am = isoToMicros(a);
  const bm = isoToMicros(b);
  if (am !== null && bm !== null) return am - bm;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return String(a) === String(b) ? 0 : Number.NaN;
  const as = String(a);
  const bs = String(b);
  return as === bs ? 0 : as < bs ? -1 : 1;
}

/** Parses the checkpoint filter `replication.ts` sends: `"m".gt.X,and("m".eq.X,"id".gt.Y)`. */
function parseCheckpointOr(expression: string): Filter {
  const match = /^"([^"]+)"\.gt\.([^,]+),and\("([^"]+)"\.eq\.([^,]+),"([^"]+)"\.gt\.([^)]+)\)$/.exec(expression);
  if (!match) throw new Error(`fake supabase: unsupported or() filter ${expression}`);
  const [, column, value, , , idColumn, id] = match;
  return (row) =>
    compare(row[column], value) > 0 || (compare(row[column], value) === 0 && compare(row[idColumn], id) > 0);
}

const ok = (data: unknown, status = 200): FakeResponse => ({ data, error: null, status });
const fail = (status: number, code: string, message: string, details: string | null = null): FakeResponse => ({
  data: null,
  error: { code, message, details, hint: null },
  status,
});
const networkError = (): FakeResponse => fail(0, "", "TypeError: Failed to fetch");

function faultResponse(fault: Fault): FakeResponse {
  switch (fault) {
    case "network":
      return networkError();
    case "timeout":
      return fail(0, "20", "AbortError: The operation was aborted.");
    case "jwt-expired":
      return fail(401, "PGRST303", "JWT expired");
    case "server-error":
      return fail(503, "", "Service Unavailable");
  }
}

export class FakeQuery implements PromiseLike<FakeResponse> {
  op: "select" | "insert" | "update" = "select";
  payload: Row | undefined;
  filters: Filter[] = [];
  orders: Array<{ column: string; ascending: boolean }> = [];
  max: number | undefined;
  returnRows = false;
  headers: Record<string, string> = {};
  private idFilters: string[] = [];

  constructor(
    private readonly server: FakeSupabaseServer,
    readonly table: string,
    readonly context: ClientContext
  ) {}

  select(_columns?: string): this {
    if (this.op !== "select") this.returnRows = true;
    return this;
  }
  insert(row: Row): this {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row): this {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  eq(column: string, value: unknown): this {
    if (column === "id") this.idFilters.push(String(value));
    this.filters.push((row) => compare(row[column], value) === 0);
    return this;
  }
  is(column: string, value: unknown): this {
    this.filters.push((row) =>
      value === null ? row[column] === null || row[column] === undefined : row[column] === value
    );
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.some((value) => compare(row[column], value) === 0));
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) > 0);
    return this;
  }
  or(expression: string): this {
    this.filters.push(parseCheckpointOr(expression));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number): this {
    this.max = count;
    return this;
  }
  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  ids(): string[] {
    return this.payload?.id ? [String(this.payload.id)] : this.idFilters;
  }
  then<A = FakeResponse, B = never>(
    onfulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.server.delay().then(() => this.server.execute(this)).then(onfulfilled, onrejected);
  }
}

export class FakeRpc implements PromiseLike<FakeResponse> {
  headers: Record<string, string> = {};
  constructor(
    private readonly server: FakeSupabaseServer,
    readonly name: string,
    readonly params: Record<string, any>,
    readonly context: ClientContext
  ) {}
  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  then<A = FakeResponse, B = never>(
    onfulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.server.delay().then(() => this.server.executeRpc(this)).then(onfulfilled, onrejected);
  }
}

export class FakeSupabaseServer {
  readonly tables = new Map<string, Map<string, Row>>();
  readonly log: LoggedRequest[] = [];
  /** Whole server unreachable (every client). */
  offline = false;
  /** Delay before each request is processed. */
  latencyMs = 0;
  private readonly columns = new Map<string, Set<string>>();
  private readonly faults: Fault[] = [];
  private readonly lostResponses = new Set<string>();
  private readonly writeDenials = new Map<string, (row: Row) => boolean>();
  private lastMicros = 0;

  constructor(private readonly options: FakeServerOptions) {
    for (const [table, columns] of Object.entries(options.tables)) {
      this.tables.set(table, new Map());
      this.columns.set(table, new Set(columns));
    }
  }

  /** Strictly increasing server clock in Postgres' format (microseconds, +00:00). */
  now(): string {
    const micros = Math.max(Date.now() * 1000, this.lastMicros + 1);
    this.lastMicros = micros;
    const ms = Math.floor(micros / 1000);
    return `${new Date(ms).toISOString().slice(0, 23)}${String(micros % 1000).padStart(3, "0")}+00:00`;
  }

  client(context: ClientContext = {}): any {
    return {
      from: (table: string) => new FakeQuery(this, table, context),
      rpc: (name: string, params: Record<string, any>) => new FakeRpc(this, name, params, context),
    };
  }

  delay(): Promise<void> {
    return this.latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }

  // ---- test controls ----
  failNext(...faults: Fault[]): void {
    this.faults.push(...faults);
  }
  loseNextResponse(table: string): void {
    this.lostResponses.add(table);
  }
  denyWrites(table: string, predicate: (row: Row) => boolean): void {
    this.writeDenials.set(table, predicate);
  }
  allowWrites(table: string): void {
    this.writeDenials.delete(table);
  }
  dropColumn(table: string, column: string): void {
    this.columns.get(table)!.delete(column);
  }
  row(table: string, id: string): Row | undefined {
    const row = this.tables.get(table)!.get(id);
    return row ? { ...row } : undefined;
  }
  rows(table: string, predicate: (row: Row) => boolean = () => true): Row[] {
    return [...this.tables.get(table)!.values()].filter(predicate).map((row) => ({ ...row }));
  }
  /** Inserts a row directly, as if it already existed on the server. */
  seed(table: string, row: Row): Row {
    const now = this.now();
    const full = { _deleted: false, created_at: now, updated_at: now, ...row, _modified: now };
    this.tables.get(table)!.set(row.id, full);
    return { ...full };
  }
  /** An edit made from another screen (API layer: no x-device-id header, so updated_at is bumped). */
  editAsWebsite(table: string, id: string, patch: Row): void {
    const row = this.tables.get(table)!.get(id);
    if (!row) throw new Error(`fake supabase: no ${table} row ${id}`);
    const now = this.now();
    Object.assign(row, patch, { updated_at: now, _modified: now });
  }
  hardDelete(table: string, id: string): void {
    this.tables.get(table)!.delete(id);
  }
  setScorer(matchId: string, scorer: { deviceId: string; userId?: string; name?: string | null; label?: string }): void {
    const match = this.tables.get("matches")!.get(matchId);
    if (!match) throw new Error(`fake supabase: no match ${matchId}`);
    const now = this.now();
    Object.assign(match, {
      scorer_device_id: scorer.deviceId,
      scorer_user_id: scorer.userId ?? "user-2",
      scorer_name: scorer.name ?? "Sam",
      scorer_device_label: scorer.label ?? "iPad",
      scorer_claimed_at: now,
      _modified: now,
    });
  }
  responseCodes(): string[] {
    return this.log.map((entry) => entry.code).filter((code): code is string => !!code);
  }

  // ---- request handling ----
  execute(query: FakeQuery): FakeResponse {
    const response = this.run(query);
    this.log.push({
      table: query.table,
      op: query.op,
      headers: { ...query.headers },
      ids: query.ids(),
      status: response.status,
      code: response.error?.code || null,
    });
    return response;
  }

  executeRpc(call: FakeRpc): FakeResponse {
    const response = this.runRpc(call);
    this.log.push({
      table: `rpc:${call.name}`,
      op: "rpc",
      headers: { ...call.headers },
      ids: [String(call.params.p_match_id ?? "")],
      status: response.status,
      code: response.error?.code || null,
    });
    return response;
  }

  private unreachable(context: ClientContext): FakeResponse | null {
    if (this.offline || context.online?.() === false) return networkError();
    const fault = this.faults.shift();
    return fault ? faultResponse(fault) : null;
  }

  private run(query: FakeQuery): FakeResponse {
    const blocked = this.unreachable(query.context);
    if (blocked) return blocked;
    const table = this.tables.get(query.table);
    if (!table) return fail(404, "42P01", `relation "public.${query.table}" does not exist`);
    if (query.op === "select") return this.select(query, table);
    if (query.op === "insert") return this.insert(query, table);
    return this.update(query, table);
  }

  private select(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    let rows = [...table.values()].filter((row) => query.filters.every((filter) => filter(row)));
    for (const { column, ascending } of [...query.orders].reverse()) {
      rows.sort((a, b) => (ascending ? 1 : -1) * (compare(a[column], b[column]) || 0));
    }
    if (query.max !== undefined) rows = rows.slice(0, query.max);
    return ok(rows.map((row) => ({ ...row })));
  }

  private insert(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    const deviceId = query.headers["x-device-id"] ?? null;
    const input = query.payload as Row;
    const unknown = this.unknownColumn(query.table, input);
    if (unknown) return fail(400, "PGRST204", `Could not find the '${unknown}' column of '${query.table}' in the schema cache`);
    const scorerFault = this.checkScorer(query.table, input, undefined, deviceId);
    if (scorerFault) return scorerFault;
    if (this.writeDenials.get(query.table)?.(input)) {
      return fail(403, "42501", `new row violates row-level security policy for table "${query.table}"`);
    }
    if (table.has(input.id)) {
      return fail(409, "23505", "duplicate key value violates unique constraint", `Key (id)=(${input.id}) already exists.`);
    }
    const fkFault = this.checkForeignKeys(query.table, input);
    if (fkFault) return fkFault;
    const now = this.now();
    const row: Row = { _deleted: false, created_at: now, updated_at: now, ...input, _modified: now };
    table.set(row.id, row);
    if (this.lostResponses.delete(query.table)) return networkError();
    return ok(query.returnRows ? [{ ...row }] : null, 201);
  }

  private update(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    const deviceId = query.headers["x-device-id"] ?? null;
    const patch = query.payload as Row;
    const unknown = this.unknownColumn(query.table, patch);
    if (unknown) return fail(400, "PGRST204", `Could not find the '${unknown}' column of '${query.table}' in the schema cache`);
    const targets = [...table.values()].filter((row) => query.filters.every((filter) => filter(row)));
    const updated: Row[] = [];
    for (const previous of targets) {
      const next: Row = { ...previous, ...patch };
      const scorerFault = this.checkScorer(query.table, next, previous, deviceId);
      if (scorerFault) return scorerFault;
      if (this.writeDenials.get(query.table)?.(next)) {
        return fail(403, "42501", `new row violates row-level security policy for table "${query.table}"`);
      }
      const fkFault = this.checkForeignKeys(query.table, next);
      if (fkFault) return fkFault;
      const now = this.now();
      // update_updated_at_column(): only requests without x-device-id get the server time.
      if (!deviceId) next.updated_at = now;
      next._modified = now;
      table.set(next.id, next);
      updated.push({ ...next });
    }
    if (updated.length > 0 && this.lostResponses.delete(query.table)) return networkError();
    return ok(query.returnRows ? updated : null);
  }

  private runRpc(call: FakeRpc): FakeResponse {
    const blocked = this.unreachable(call.context);
    if (blocked) return blocked;
    const match = this.tables.get("matches")!.get(call.params.p_match_id);
    if (!match) return fail(400, "P0002", "match_not_found");
    if (call.name === "get_match_scorer") return ok(this.scorerInfo(match));
    if (call.name === "claim_match_scorer") {
      const free = !match.scorer_device_id || match.scorer_device_id === call.params.p_device_id;
      if (free || call.params.p_force) {
        const now = this.now();
        Object.assign(match, {
          scorer_device_id: call.params.p_device_id,
          scorer_user_id: call.context.userId ?? "user-1",
          scorer_name: call.context.userName === undefined ? "Alex" : call.context.userName,
          scorer_device_label: call.params.p_label,
          scorer_claimed_at: now,
          _modified: now,
        });
        return ok({ claimed: true, ...this.scorerInfo(match) });
      }
      return ok({ claimed: false, ...this.scorerInfo(match) });
    }
    return fail(404, "PGRST202", `Could not find the function public.${call.name}`);
  }

  private scorerInfo(match: Row): Row {
    const times = [
      match._modified,
      ...["sets", "score_points", "player_stats", "events"].flatMap((table) =>
        this.rows(table, (row) => row.match_id === match.id).map((row) => row._modified)
      ),
    ].filter(Boolean);
    times.sort((a, b) => compare(a, b));
    return {
      scorer_device_id: match.scorer_device_id ?? null,
      scorer_user_id: match.scorer_user_id ?? null,
      scorer_name: match.scorer_name ?? null,
      scorer_device_label: match.scorer_device_label ?? null,
      scorer_claimed_at: match.scorer_claimed_at ?? null,
      last_activity_at: times.at(-1) ?? null,
    };
  }

  private checkScorer(table: string, next: Row, previous: Row | undefined, deviceId: string | null): FakeResponse | null {
    if (!deviceId) return null;
    const mismatch = fail(400, "P0001", "scorer_mismatch");
    if (table === "matches") {
      if (!previous?.scorer_device_id) return null;
      if (next.scorer_device_id !== previous.scorer_device_id) return null; // a claim
      return previous.scorer_device_id !== deviceId ? mismatch : null;
    }
    if (!this.options.scorerTables?.includes(table)) return null;
    const scorer = this.tables.get("matches")?.get(next.match_id)?.scorer_device_id;
    return scorer && scorer !== deviceId ? mismatch : null;
  }

  private checkForeignKeys(table: string, row: Row): FakeResponse | null {
    for (const fk of this.options.foreignKeys ?? []) {
      if (fk.table !== table) continue;
      const value = row[fk.column];
      if (value === null || value === undefined) continue;
      if (!this.tables.get(fk.refTable)?.has(value)) {
        return fail(
          409,
          "23503",
          `insert or update on table "${table}" violates foreign key constraint "${table}_${fk.column}_fkey"`,
          `Key (${fk.column})=(${value}) is not present in table "${fk.refTable}".`
        );
      }
    }
    return null;
  }

  private unknownColumn(table: string, row: Row): string | null {
    const columns = this.columns.get(table)!;
    return Object.keys(row).find((key) => !columns.has(key)) ?? null;
  }
}
