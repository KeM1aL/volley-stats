import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel, SetReport } from "@/lib/report/build";
import { ZONES } from "@/lib/report/metrics/zones";
import { commentNumbers } from "./charts/geometry";
import { Timeline } from "./charts/timeline";
import { Court } from "./court";
import { homeAway, playerLabel, teamName, type ReportT } from "./format";
import { Footer, Stat } from "./parts";
import { EventTable, PlayerTable, ServerTable } from "./tables";
import { styles } from "./theme";

export function SetPage({ model, set, t, locale }: { model: MatchReportModel; set: SetReport; t: ReportT; locale: string }) {
  const numbers = commentNumbers(set.events);
  const comments = set.events.filter((e) => e.type === "comment");
  const sides = `${model.us.name} / ${model.them.name}`;
  const status = [
    set.winner ? t("set.winner", { team: teamName(model, set.winner) }) : t("inProgress"),
    set.durationMinutes !== null ? t("minutes", { minutes: set.durationMinutes }) : null,
    t("set.firstServer", { team: teamName(model, set.firstServer) }),
  ].filter(Boolean);

  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={styles.h1}>{t("setLabel", { number: set.number })}</Text>
        <Text style={styles.bigNumber}>{homeAway(model, set.score)}</Text>
      </View>
      <Text style={styles.muted}>{status.join(" · ")}</Text>

      {model.format.sixPlayers ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("set.startingSix")}</Text>
          <Court cells={Object.fromEntries(ZONES.map((zone) => [zone, set.startingSix[zone] ? playerLabel(model, set.startingSix[zone], t) : ""]))} />
        </View>
      ) : null}

      <Text style={styles.h2}>{t("set.timeline")}</Text>
      {set.rallies.length === 0 ? (
        <Text>{t("noData")}</Text>
      ) : (
        <View wrap={false}>
          <Timeline set={set} />
          <Text style={styles.small}>{t("set.legend")}</Text>
        </View>
      )}

      <Text style={styles.h2}>{t("set.flow")}</Text>
      <View style={styles.row}>
        <Stat label={t("set.largestLead")} value={`${set.flow.largestLead.us} / ${set.flow.largestLead.them}`} hint={sides} />
        <Stat label={t("set.longestRun")} value={`${set.flow.longestRun.us} / ${set.flow.longestRun.them}`} hint={sides} />
        <Stat label={t("set.ties")} value={String(set.flow.ties)} />
        <Stat label={t("set.leadChanges")} value={String(set.flow.leadChanges)} />
        <Stat label={t("set.deficitOvercome")} value={String(set.flow.deficitOvercome)} />
      </View>
      <Text style={{ marginTop: 6 }}>
        <Text style={{ fontWeight: 700 }}>{`${t("set.ending")}: `}</Text>
        {set.ending.from
          ? t("set.endingFrom", { score: homeAway(model, set.ending.from), wonUs: set.ending.won.us, wonThem: set.ending.won.them })
          : t("set.endingNotReached", { threshold: set.ending.threshold })}
      </Text>

      <Text style={styles.h2}>{t("set.events")}</Text>
      {set.events.length === 0 ? <Text style={styles.muted}>{t("set.noEvents")}</Text> : <EventTable model={model} events={set.events} numbers={numbers} t={t} />}

      <Text style={styles.h2}>{t("detail.players")}</Text>
      <PlayerTable model={model} players={set.players} total={set.total} t={t} />

      {set.servers && set.servers.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.servers")}</Text>
          <ServerTable model={model} servers={set.servers} t={t} />
        </View>
      ) : null}

      {comments.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("set.comments")}</Text>
          {comments.map((c) => (
            <Text key={c.eventId}>{`${numbers.get(c.eventId)}. ${homeAway(model, c.score)} — ${c.text ?? ""}`}</Text>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
