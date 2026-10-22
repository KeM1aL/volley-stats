"use client";

import { useTranslations } from "next-intl";

/** Placeholders the publisher fills in before the store release; they stay visible until then. */
const PUBLISHER_NAME = "[Publisher name]";
const CONTACT_EMAIL = "[contact@example.com]";

const COLLECTED_ITEMS = ["account", "profile", "content", "device"] as const;

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8 sm:py-12" data-testid="privacy-policy">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("intro", { publisher: PUBLISHER_NAME })}</p>

      <div className="space-y-8">
        <section aria-labelledby="privacy-collected">
          <h2 id="privacy-collected" className="text-xl font-semibold mb-2">{t("collected.title")}</h2>
          <p className="mb-2">{t("collected.intro")}</p>
          <ul className="list-disc pl-6 space-y-1">
            {COLLECTED_ITEMS.map((item) => (
              <li key={item}>{t(`collected.items.${item}`)}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privacy-purpose">
          <h2 id="privacy-purpose" className="text-xl font-semibold mb-2">{t("purpose.title")}</h2>
          <p>{t("purpose.body")}</p>
        </section>

        <section aria-labelledby="privacy-no-selling">
          <h2 id="privacy-no-selling" className="text-xl font-semibold mb-2">{t("noSelling.title")}</h2>
          <p>{t("noSelling.body")}</p>
        </section>

        <section aria-labelledby="privacy-analytics">
          <h2 id="privacy-analytics" className="text-xl font-semibold mb-2">{t("analytics.title")}</h2>
          <p className="mb-2">{t("analytics.app")}</p>
          <p>{t("analytics.web")}</p>
        </section>

        <section aria-labelledby="privacy-processor">
          <h2 id="privacy-processor" className="text-xl font-semibold mb-2">{t("processor.title")}</h2>
          <p>{t("processor.body")}</p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention" className="text-xl font-semibold mb-2">{t("retention.title")}</h2>
          <p>{t("retention.body")}</p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights" className="text-xl font-semibold mb-2">{t("rights.title")}</h2>
          <p>{t("rights.body")}</p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact" className="text-xl font-semibold mb-2">{t("contact.title")}</h2>
          <p>{t("contact.body", { email: CONTACT_EMAIL })}</p>
        </section>
      </div>
    </div>
  );
}
