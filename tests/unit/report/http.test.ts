import { describe, expect, it } from "vitest";
import { fileNameFromDisposition } from "@/lib/report/download";
import { contentDisposition, reportEtag, reportFileName, resolveLocale } from "@/lib/report/http";

describe("resolveLocale", () => {
  it("prefers the requested locale, then the profile language, then English", () => {
    expect(resolveLocale("fr", "it")).toBe("fr");
    expect(resolveLocale("de", "it")).toBe("it");
    expect(resolveLocale(null, "xx")).toBe("en");
  });
});

describe("reportEtag", () => {
  const base = { lastModified: "2026-10-01T10:00:00.000000+00:00", locale: "fr" as const, teamId: "team-1", version: 1 };

  it("is stable and quoted", () => {
    expect(reportEtag(base)).toBe(reportEtag({ ...base }));
    expect(reportEtag(base)).toMatch(/^"[0-9a-f]{40}"$/);
  });

  it("changes with any part", () => {
    const etag = reportEtag(base);
    expect(reportEtag({ ...base, lastModified: "2026-10-02T10:00:00.000000+00:00" })).not.toBe(etag);
    expect(reportEtag({ ...base, locale: "en" })).not.toBe(etag);
    expect(reportEtag({ ...base, teamId: "team-2" })).not.toBe(etag);
    expect(reportEtag({ ...base, version: 2 })).not.toBe(etag);
  });
});

describe("file names", () => {
  it("builds an ASCII name and a UTF-8 name that round-trips", () => {
    const name = reportFileName("Volley Club", "Les Étoiles (B)", "2026-10-01T18:00:00.000Z");
    expect(name).toBe("Volley Club-vs-Les Étoiles (B)-2026-10-01.pdf");
    const header = contentDisposition(name);
    expect(header).toContain('filename="volley-club-vs-les-etoiles-b-2026-10-01.pdf"');
    expect(header).toContain("filename*=UTF-8''Volley%20Club-vs-Les%20%C3%89toiles%20%28B%29-2026-10-01.pdf");
    expect(fileNameFromDisposition(header)).toBe(name);
  });

  it("falls back to the plain name, or null", () => {
    expect(fileNameFromDisposition('attachment; filename="report.pdf"')).toBe("report.pdf");
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});
