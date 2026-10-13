import { Text, View } from "@react-pdf/renderer";
import type { Zone } from "@/lib/report/metrics/zones";
import { COLORS } from "./theme";

const LAYOUT: Zone[][] = [
  ["p4", "p3", "p2"],
  ["p5", "p6", "p1"],
];

/** A half court seen from behind the end line, net on top; one cell per position. */
export function Court({ cells, width = 240 }: { cells: Partial<Record<Zone, string>>; width?: number }) {
  return (
    <View style={{ width, borderWidth: 1, borderColor: COLORS.text }}>
      <View style={{ height: 3, backgroundColor: COLORS.text }} />
      {LAYOUT.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", borderTopWidth: r === 0 ? 0 : 0.5, borderTopColor: COLORS.muted }}>
          {row.map((zone, c) => (
            <View key={zone} style={{ width: width / 3, height: 36, padding: 3, borderLeftWidth: c === 0 ? 0 : 0.5, borderLeftColor: COLORS.grid }}>
              <Text style={{ fontSize: 6, color: COLORS.muted }}>{zone.toUpperCase()}</Text>
              <Text style={{ textAlign: "center", marginTop: 3 }}>{cells[zone] ?? ""}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
