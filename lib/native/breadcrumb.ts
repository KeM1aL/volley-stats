import { normalizePath } from "@/lib/routes";

export type Crumb = { label: string; href?: string };

export interface BreadcrumbNames {
  /** Name of the team / championship / match the page shows (blank or missing: a generic label). */
  team?: string | null;
  championship?: string | null;
  /** "Home – Away" */
  match?: string | null;
  /** Where the team crumb links to on the players page (the team's page). */
  teamHref?: string;
  /** Where the match crumb links to on the score page (the match's stats page). */
  matchHref?: string;
}

const name = (value: string | null | undefined, fallback: string): string => value?.trim() || fallback;

/**
 * The trail shown at the top of sub-pages in the installed app. Empty for tab roots, the landing page, sign-in pages and the
 * live match (it has its own back button). `t` is the `navigation` translator (`menu.*` and `breadcrumb.*` keys). Every crumb
 * but the last is a link; the middle crumb of the players / score pages links only when the page passes its href.
 */
export function breadcrumbFor(pathname: string, names: BreadcrumbNames, t: (key: string) => string): Crumb[] {
  const teams: Crumb = { label: t("menu.teams"), href: "/teams" };
  const matches: Crumb = { label: t("menu.matches"), href: "/matches" };
  const team = name(names.team, t("breadcrumb.team"));
  const match = name(names.match, t("breadcrumb.match"));

  switch (normalizePath(pathname)) {
    case "/teams/view":
      return [teams, { label: team }];
    case "/teams/players":
      return [teams, names.teamHref ? { label: team, href: names.teamHref } : { label: team }, { label: t("breadcrumb.players") }];
    case "/teams/new":
      return [teams, { label: t("breadcrumb.newTeam") }];
    case "/championships/view":
      return [
        { label: t("menu.championships"), href: "/championships" },
        { label: name(names.championship, t("breadcrumb.championship")) },
      ];
    case "/matches/stats":
      return [matches, { label: match }];
    case "/matches/score":
      return [matches, names.matchHref ? { label: match, href: names.matchHref } : { label: match }, { label: t("breadcrumb.score") }];
    case "/privacy":
      return [{ label: t("menu.profile"), href: "/settings" }, { label: t("breadcrumb.privacy") }];
    default:
      return [];
  }
}

/** "Home – Away" for the match crumb, or undefined while a team name is unknown (the crumb then falls back to "Match"). */
export function matchLabel(home: string | null | undefined, away: string | null | undefined): string | undefined {
  const h = home?.trim();
  const a = away?.trim();
  return h && a ? `${h} – ${a}` : undefined;
}
