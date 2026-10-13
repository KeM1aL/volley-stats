import { Text, View } from "@react-pdf/renderer";
import { LOSS_ORIGINS, WIN_ORIGINS, type TeamSummary } from "@/lib/report/metrics/team";
import type { ReportT } from "../format";
import { ORIGIN_COLORS, PAGE_WIDTH } from "../theme";

const LABEL_WIDTH = 60;
const TOTAL_WIDTH = 30;

/** Two stacked bars (points won, points lost) split by origin, with a legend under each. */
export function OriginBars({ team, t }: { team: TeamSummary; t: ReportT }) {
  const max = Math.max(team.won, team.lost, 1);
  const barWidth = PAGE_WIDTH - LABEL_WIDTH - TOTAL_WIDTH;
  const won = WIN_ORIGINS.map((origin) => [origin, team.wonBy[origin]] as const);
  const lost = LOSS_ORIGINS.map((origin) => [origin, team.lostBy[origin]] as const);
  const ownErrors = Object.entries(team.ownErrorsByAction)
    .filter(([, n]) => n > 0)
    .map(([action, n]) => `${t(`actions.${action}`)} ${n}`)
    .join(" · ");

  const bar = (label: string, total: number, parts: readonly (readonly [string, number])[]) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
      <Text style={{ width: LABEL_WIDTH }}>{label}</Text>
      <View style={{ flexDirection: "row", width: barWidth, height: 12 }}>
        {parts
          .filter(([, n]) => n > 0)
          .map(([key, n]) => (
            <View key={key} style={{ width: (n / max) * barWidth, height: 12, backgroundColor: ORIGIN_COLORS[key] }} />
          ))}
      </View>
      <Text style={{ width: TOTAL_WIDTH, textAlign: "right", fontWeight: 700 }}>{total}</Text>
    </View>
  );
  const legend = (parts: readonly (readonly [string, number])[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: LABEL_WIDTH, marginBottom: 6 }}>
      {parts.map(([key, n]) => (
        <View key={key} style={{ flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 }}>
          <View style={{ width: 7, height: 7, backgroundColor: ORIGIN_COLORS[key], marginRight: 3 }} />
          <Text style={{ fontSize: 7 }}>{`${t(`origin.${key}`)} ${n}`}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View>
      {bar(t("summary.won"), team.won, won)}
      {legend(won)}
      {bar(t("summary.lost"), team.lost, lost)}
      {legend(lost)}
      {ownErrors ? <Text style={{ fontSize: 7, marginLeft: LABEL_WIDTH }}>{`${t("origin.ownError")}: ${ownErrors}`}</Text> : null}
    </View>
  );
}
