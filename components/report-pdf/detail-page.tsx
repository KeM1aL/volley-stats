import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { ZONES } from "@/lib/report/metrics/zones";
import { Court } from "./court";
import { teamName, type ReportT } from "./format";
import { Footer } from "./parts";
import { PlayerTable, RoleTable, ServerTable } from "./tables";
import { styles } from "./theme";

export function DetailPage({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  const zones = model.zones;
  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <Text style={styles.h1}>{t("detail.title")}</Text>

      <Text style={styles.h2}>{t("detail.players")}</Text>
      <PlayerTable model={model} players={model.players} total={model.total} t={t} />
      <Text style={styles.small}>{t("detail.legend")}</Text>

      {model.roles.length > 0 ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("detail.byRole")}</Text>
          <RoleTable model={model} roles={model.roles} t={t} />
        </View>
      ) : null}

      {zones ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("detail.byZone")}</Text>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Court cells={Object.fromEntries(ZONES.map((zone) => [zone, t("table.zonePoints", { points: zones.zones[zone].points, errors: zones.zones[zone].errors })]))} />
            <View>
              <Text>{`${t("detail.frontRow")}: ${t("table.zonePoints", { points: zones.frontRow.points, errors: zones.frontRow.errors })}`}</Text>
              <Text>{`${t("detail.backRow")}: ${t("table.zonePoints", { points: zones.backRow.points, errors: zones.backRow.errors })}`}</Text>
              {zones.unplaced > 0 ? <Text style={styles.muted}>{t("detail.unplaced", { count: zones.unplaced })}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      {model.servers && model.servers.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.servers")}</Text>
          <ServerTable model={model} servers={model.servers} t={t} />
        </View>
      ) : null}

      {model.matchEvents.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.matchEvents")}</Text>
          {model.matchEvents.map((e) => (
            <Text key={e.eventId}>{`${t(`events.${e.type}`)}${e.team ? ` (${teamName(model, e.team)})` : ""}${e.text ? ` — ${e.text}` : ""}`}</Text>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
