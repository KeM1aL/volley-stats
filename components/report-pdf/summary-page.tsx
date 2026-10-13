import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { DiffChart } from "./charts/diff-chart";
import { OriginBars } from "./charts/origin-bars";
import { awayTeam, DASH, formatDate, homeAway, homeTeam, pct, playerLabel, signed, type ReportT } from "./format";
import { Footer, Stat } from "./parts";
import { COLORS, PAGE_WIDTH, styles } from "./theme";

export function SummaryPage({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  const home = homeTeam(model);
  const away = awayTeam(model);
  const setsWon = homeAway(model, model.setsWon);
  const leaders = model.leaders;
  const mvpLines = [
    model.mvp ? `${t("summary.matchMvp")}: ${playerLabel(model, model.mvp.playerId, t)}` : null,
    ...model.sets.map((set) => (set.mvp ? `${t("setLabel", { number: set.number })}: ${playerLabel(model, set.mvp.playerId, t)}` : null)),
  ].filter((line): line is string => line !== null);
  const momentumWidth = (PAGE_WIDTH - 6 * Math.max(model.sets.length - 1, 0)) / Math.max(model.sets.length, 1);

  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <Text style={styles.muted}>{t("title")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
        <Text style={styles.h1}>
          <Text style={{ color: home.id === model.us.id ? COLORS.us : COLORS.text }}>{home.name}</Text>
          {"  –  "}
          <Text style={{ color: away.id === model.us.id ? COLORS.us : COLORS.text }}>{away.name}</Text>
        </Text>
        <Text style={styles.bigNumber}>{setsWon}</Text>
      </View>
      <Text style={styles.muted}>{[formatDate(model.date, locale), model.location, model.championship].filter(Boolean).join(" · ")}</Text>
      {!model.completed ? <Text style={{ color: COLORS.them, fontWeight: 700, marginTop: 2 }}>{t("inProgress")}</Text> : null}
      <Text style={{ marginTop: 6 }}>{model.sets.map((set) => homeAway(model, set.score)).join("    ")}</Text>

      {model.team.rallies === 0 ? (
        <Text style={{ marginTop: 20 }}>{t("noData")}</Text>
      ) : (
        <View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Stat label={t("summary.sideOut")} value={pct(model.team.sideOut)} hint={t("summary.sideOutHint")} />
            <Stat label={t("summary.breakPoint")} value={pct(model.team.breakPoint)} hint={t("summary.breakPointHint")} />
            <Stat label={t("summary.duration")} value={model.durationMinutes === null ? DASH : t("minutes", { minutes: model.durationMinutes })} />
          </View>

          <View wrap={false}>
            <Text style={styles.h2}>{t("summary.pointsOrigin")}</Text>
            <OriginBars team={model.team} t={t} />
          </View>

          <View wrap={false}>
            <Text style={styles.h2}>{t("summary.leaders")}</Text>
            <View style={styles.row}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("summary.topScorers")}</Text>
                {leaders.topScorers.length === 0 ? (
                  <Text>{DASH}</Text>
                ) : (
                  leaders.topScorers.map((s) => <Text key={s.playerId}>{`${playerLabel(model, s.playerId, t)} · ${t("summary.points", { count: s.points })}`}</Text>)
                )}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("summary.bestServer")}</Text>
                <Text>
                  {leaders.bestServer
                    ? t("summary.bestServerValue", {
                        name: playerLabel(model, leaders.bestServer.playerId, t),
                        run: leaders.bestServer.longestRun,
                        pct: pct({ pct: leaders.bestServer.breakPct }),
                      })
                    : DASH}
                </Text>
                <Text style={[styles.cardTitle, { marginTop: 6 }]}>{t("summary.bestPlusMinus")}</Text>
                <Text>{leaders.bestPlusMinus ? `${playerLabel(model, leaders.bestPlusMinus.playerId, t)} ${signed(leaders.bestPlusMinus.plusMinus)}` : DASH}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("summary.mvp")}</Text>
                {mvpLines.length === 0 ? <Text>{DASH}</Text> : mvpLines.map((line) => <Text key={line}>{line}</Text>)}
              </View>
            </View>
          </View>

          <View wrap={false}>
            <Text style={styles.h2}>{t("summary.momentum")}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {model.sets.map((set) => (
                <View key={set.setId} style={{ width: momentumWidth }}>
                  <Text style={{ fontSize: 7 }}>{`${t("setLabel", { number: set.number })} · ${homeAway(model, set.score)}`}</Text>
                  <DiffChart rallies={set.rallies} width={momentumWidth} height={40} />
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.muted, { marginTop: 10 }]}>
            {t("summary.coverage", { pct: pct(model.team.coverage), typed: model.team.coverage.made, total: model.team.coverage.of })}
          </Text>
        </View>
      )}
    </Page>
  );
}
