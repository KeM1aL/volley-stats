"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";

type GuardedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** A `next/link` that asks before leaving a live match. New-tab clicks pass through: they don't leave. */
export function GuardedLink({ href, onClick, ...props }: GuardedLinkProps) {
  const router = useRouter();
  const { isActive, confirmLeave } = useConfirmLeave();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isActive()) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void confirmLeave().then((decision) => {
      if (decision !== "stay") router.push(href);
    });
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
