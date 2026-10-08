"use client";

import { useTranslations } from "next-intl";
import type { SyncReasonInfo } from "@/lib/rxdb/sync/status";

/** One line explaining why changes couldn't be saved. */
export function SyncReason({ reason }: { reason: SyncReasonInfo }) {
  const t = useTranslations("sync");
  const table = t(`tables.${reason.params.table ?? "unknown"}`);
  return <p className="text-destructive">{t(`errors.${reason.code}`, { table })}</p>;
}
