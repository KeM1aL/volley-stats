export type Row = Record<string, any>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** Rows of a Supabase query; throws on a query error. */
export async function rows(query: PromiseLike<QueryResult>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}

/** Rows not soft-deleted. */
export const live = (list: Row[]): Row[] => list.filter((row) => row._deleted !== true);
