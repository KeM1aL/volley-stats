import { describe, expect, it } from "vitest";
import { Table } from "@/components/report-pdf/table";

const columns = [{ label: "A", width: 100 }];
const rows = (count: number) => Array.from({ length: count }, (_, i) => [String(i)]);

describe("Table", () => {
  it("keeps its title in the first unbreakable block, so they move to a new page together", () => {
    const [first, second] = Table({ title: "Joueurs", columns, rows: rows(30) }).props.children;
    expect(first.props.wrap).toBe(false);
    expect(first.props.children[0].props.children).toBe("Joueurs");
    expect(second.props.wrap).toBe(false);
    expect(second.props.children[0]).toBeNull();
  });

  it("draws no title without one", () => {
    const [first] = Table({ columns, rows: rows(2) }).props.children;
    expect(first.props.children[0]).toBeNull();
  });
});
