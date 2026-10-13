import { Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { awayTeam, formatDate, homeTeam, type ReportT } from "./format";
import { styles } from "./theme";

export function Footer({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{`${homeTeam(model).name} – ${awayTeam(model).name} · ${formatDate(model.date, locale)}`}</Text>
      <Text render={({ pageNumber, totalPages }) => t("page", { page: pageNumber, total: totalPages })} />
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.bigNumber}>{value}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
    </View>
  );
}
