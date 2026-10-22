"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { GuardedLink } from "@/components/guarded-link";
import { useNativeApp } from "@/components/navigation/use-native-app";
import { breadcrumbFor, type BreadcrumbNames, type Crumb } from "@/lib/native/breadcrumb";

/**
 * Installed app only (the website has the header): the trail at the top of a sub-page. Pass `items`, or `names` of what the
 * page already shows (team, championship, match) to get the trail for the current path. Every crumb but the last is a link
 * through the leave guard; the last is the current page. Long names are truncated.
 */
export function AppBreadcrumb({ items, names = {} }: { items?: Crumb[]; names?: BreadcrumbNames }) {
  const nativeApp = useNativeApp();
  const pathname = usePathname();
  const t = useTranslations("navigation");
  if (!nativeApp) return null;

  const crumbs = items ?? breadcrumbFor(pathname ?? "/", names, t);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label={t("breadcrumb.ariaLabel")} className="mb-3 min-w-0" data-testid="app-breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              {index > 0 && <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <li className="min-w-0">
                {last || !crumb.href ? (
                  <span className="block max-w-[40vw] truncate font-medium text-foreground" aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                ) : (
                  <GuardedLink href={crumb.href} className="block max-w-[40vw] truncate underline-offset-4 hover:text-foreground hover:underline">
                    {crumb.label}
                  </GuardedLink>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
