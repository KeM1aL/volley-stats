import { describe, expect, it } from "vitest";
import { breadcrumbFor, matchLabel } from "@/lib/native/breadcrumb";
import { routes } from "@/lib/routes";

const LABELS: Record<string, string> = {
  "menu.teams": "Teams",
  "menu.matches": "Matches",
  "menu.championships": "Championships",
  "menu.profile": "Profile",
  "breadcrumb.players": "Players",
  "breadcrumb.newTeam": "New team",
  "breadcrumb.score": "Score",
  "breadcrumb.privacy": "Privacy",
  "breadcrumb.home": "Home page",
  "breadcrumb.team": "Team",
  "breadcrumb.match": "Match",
  "breadcrumb.championship": "Championship",
};
const t = (key: string) => LABELS[key] ?? `?${key}`;

const ID = "11111111-1111-4111-8111-111111111111";

describe("breadcrumbFor", () => {
  it("teams view: Teams > team", () =>
    expect(breadcrumbFor("/teams/view", { team: "Les Aigles" }, t)).toEqual([
      { label: "Teams", href: "/teams" },
      { label: "Les Aigles" },
    ]));

  it("teams players: Teams > team (link) > Players", () =>
    expect(breadcrumbFor("/teams/players/", { team: "Les Aigles", teamHref: routes.team(ID) }, t)).toEqual([
      { label: "Teams", href: "/teams" },
      { label: "Les Aigles", href: routes.team(ID) },
      { label: "Players" },
    ]));

  it("teams new: Teams > New team", () =>
    expect(breadcrumbFor("/teams/new", {}, t)).toEqual([
      { label: "Teams", href: "/teams" },
      { label: "New team" },
    ]));

  it("championship view", () =>
    expect(breadcrumbFor("/championships/view", { championship: "Ligue A" }, t)).toEqual([
      { label: "Championships", href: "/championships" },
      { label: "Ligue A" },
    ]));

  it("match stats: Matches > home - away", () =>
    expect(breadcrumbFor("/matches/stats", { match: "Home – Away" }, t)).toEqual([
      { label: "Matches", href: "/matches" },
      { label: "Home – Away" },
    ]));

  it("match score: Matches > match (stats link) > Score", () =>
    expect(breadcrumbFor("/matches/score", { match: "Home – Away", matchHref: routes.matchStats(ID) }, t)).toEqual([
      { label: "Matches", href: "/matches" },
      { label: "Home – Away", href: routes.matchStats(ID) },
      { label: "Score" },
    ]));

  it("match score without a known link keeps the match as plain text", () =>
    expect(breadcrumbFor("/matches/score", { match: "Home – Away" }, t)).toEqual([
      { label: "Matches", href: "/matches" },
      { label: "Home – Away" },
      { label: "Score" },
    ]));

  it("privacy: Profile > Privacy", () =>
    expect(breadcrumbFor("/privacy", {}, t)).toEqual([
      { label: "Profile", href: "/settings" },
      { label: "Privacy" },
    ]));

  it("is empty for tab roots, the landing page, auth pages and the live match", () => {
    for (const path of ["/teams", "/matches", "/championships", "/settings", "/settings/", "/", "/auth", "/auth/callback", "/matches/live"]) {
      expect(breadcrumbFor(path, { team: "x", match: "y" }, t), path).toEqual([]);
    }
  });

  it("is empty for an unknown path", () => expect(breadcrumbFor("/nope", {}, t)).toEqual([]));

  it("falls back to a generic label for a missing or blank name, never an empty crumb", () => {
    expect(breadcrumbFor("/teams/view", {}, t)[1]).toEqual({ label: "Team" });
    expect(breadcrumbFor("/teams/view", { team: "  " }, t)[1]).toEqual({ label: "Team" });
    expect(breadcrumbFor("/matches/stats", {}, t)[1]).toEqual({ label: "Match" });
    expect(breadcrumbFor("/championships/view", {}, t)[1]).toEqual({ label: "Championship" });
  });
});

describe("breadcrumbFor signed out", () => {
  const out = { signedIn: false };
  it("sends the first crumb home on the public stats page", () =>
    expect(breadcrumbFor("/matches/stats", { match: "Home – Away" }, t, out)).toEqual([
      { label: "Home page", href: "/" },
      { label: "Home – Away" },
    ]));
  it("sends the first crumb home on the privacy page", () =>
    expect(breadcrumbFor("/privacy", {}, t, out)).toEqual([{ label: "Home page", href: "/" }, { label: "Privacy" }]));
  it("keeps the signed-in labels and links", () => {
    expect(breadcrumbFor("/privacy", {}, t, { signedIn: true })[0]).toEqual({ label: "Profile", href: "/settings" });
    expect(breadcrumbFor("/privacy", {}, t)[0]).toEqual({ label: "Profile", href: "/settings" });
  });
});

describe("matchLabel", () => {
  it("joins the two team names", () => expect(matchLabel("Home", "Away")).toBe("Home – Away"));
  it("is undefined while a name is missing", () => {
    expect(matchLabel("Home", undefined)).toBeUndefined();
    expect(matchLabel(null, "Away")).toBeUndefined();
    expect(matchLabel(" ", "Away")).toBeUndefined();
  });
});
