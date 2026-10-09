"use client";

import { useTranslations } from "next-intl";
import { reasonKeys, type SyncReasonInfo } from "@/lib/rxdb/sync/status";

/** One line explaining why changes couldn't be saved. */
export function SyncReason({ reason }: { reason: SyncReasonInfo }) {
  const t = useTranslations("sync");
  const keys = reasonKeys(reason, (key) => t.has(key));
  return <p className="text-destructive">{t(keys.message, { table: t(keys.table) })}</p>;
}
