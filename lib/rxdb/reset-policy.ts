export type DatabaseResetDecision = "reset" | "blocked" | "keep";

/** Whether a local database that failed to open may be deleted (spec section 8). */
export function decideDatabaseReset({
  isSchemaError,
  devEnvironment,
  removeFlag,
  force,
  unsentCount,
}: {
  isSchemaError: boolean;
  devEnvironment: boolean;
  removeFlag: boolean;
  /** The user chose to delete the local data although changes are unsent (`?remove-database=force`). */
  force: boolean;
  unsentCount: number;
}): DatabaseResetDecision {
  if (!isSchemaError || !(devEnvironment || removeFlag || force)) return "keep";
  return unsentCount > 0 && !force ? "blocked" : "reset";
}
