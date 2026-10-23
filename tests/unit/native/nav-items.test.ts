import { describe, expect, it } from "vitest";
import { CircleUser, Settings } from "lucide-react";
import { navItems } from "@/components/navigation/nav-items";

const t = (key: string) => key;

describe("navItems", () => {
  it("keeps Settings and its icon for the website", () => {
    const last = navItems(t).at(-1);
    expect(last).toMatchObject({ href: "/settings", label: "menu.settings", icon: Settings });
  });
  it("turns the last entry into the Profile (person icon) in the installed app", () => {
    const items = navItems(t, { nativeApp: true });
    expect(items.at(-1)).toMatchObject({ href: "/settings", label: "menu.profile", icon: CircleUser });
    expect(items.map((item) => item.href)).toEqual(["/championships", "/matches", "/teams", "/settings"]);
  });
});
