import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import type { MatchReportModel } from "@/lib/report/build";
import en from "@/messages/en";
import es from "@/messages/es";
import fr from "@/messages/fr";
import it from "@/messages/it";
import pt from "@/messages/pt";
import type { ReportT } from "./format";
import { MatchReportDocument } from "./match-report";
import { registerReportFonts } from "./theme";

const MESSAGES = { en, es, fr, it, pt };

/** Translator of the `report` namespace. `strict` throws on a missing key or bad argument (tests). */
export function reportTranslator(locale: Locale, options: { strict?: boolean } = {}): ReportT {
  const translate = createTranslator({
    locale,
    messages: MESSAGES[locale] as any,
    namespace: "report" as any,
    onError: options.strict
      ? (error) => {
          throw error;
        }
      : undefined,
  });
  return (key, values) => (translate as unknown as ReportT)(key, values);
}

export async function renderMatchReport(model: MatchReportModel, locale: Locale, options: { strict?: boolean } = {}): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<MatchReportDocument model={model} t={reportTranslator(locale, options)} locale={locale} />);
}
