import { Document } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { DetailPage } from "./detail-page";
import { awayTeam, homeTeam, type ReportT } from "./format";
import { SetPage } from "./set-page";
import { SummaryPage } from "./summary-page";

export function MatchReportDocument({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  return (
    <Document title={`${t("title")} – ${homeTeam(model).name} – ${awayTeam(model).name}`} language={locale} creator="VolleyStats" producer="VolleyStats">
      <SummaryPage model={model} t={t} locale={locale} />
      <DetailPage model={model} t={t} locale={locale} />
      {model.sets.map((set) => (
        <SetPage key={set.setId} model={model} set={set} t={t} locale={locale} />
      ))}
    </Document>
  );
}
