export type DatabaseResetDecision = "reset" | "blocked" | "keep";

/** Whether a local database that failed to open may be deleted (spec section 8). */
export function decideDatabaseReset({
  isSchemaError,
  devEnvironment,
  removeFlag,
  unsentCount,
}: {
  isSchemaError: boolean;
  devEnvironment: boolean;
  removeFlag: boolean;
  unsentCount: number;
}): DatabaseResetDecision {
  if (!isSchemaError || !(devEnvironment || removeFlag)) return "keep";
  return unsentCount > 0 ? "blocked" : "reset";
}
