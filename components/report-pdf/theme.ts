import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";

export const FONT = "NotoSans";
/** A4 width (595 pt) minus the 32 pt side margins. */
export const PAGE_WIDTH = 531;

export const COLORS = {
  us: "#2563eb",
  them: "#dc2626",
  text: "#111827",
  muted: "#6b7280",
  grid: "#e5e7eb",
  zebra: "#f9fafb",
  header: "#f3f4f6",
};

export const ORIGIN_COLORS: Record<string, string> = {
  ace: "#1e3a8a",
  kill: "#2563eb",
  block: "#60a5fa",
  otherWinner: "#93c5fd",
  opponentError: "#a5b4fc",
  unspecified: "#d1d5db",
  ownError: "#dc2626",
  opponentWinner: "#fca5a5",
};

let fontsRegistered = false;

/** Noto Sans covers accents and most scripts in player names. The files are traced into the route (next.config.js). */
export function registerReportFonts(): void {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "lib", "report", "fonts");
  Font.register({
    family: FONT,
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export const styles = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 8.5, color: COLORS.text, paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32 },
  h1: { fontSize: 18, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  muted: { color: COLORS.muted },
  small: { fontSize: 6.5, color: COLORS.muted, marginTop: 2 },
  bigNumber: { fontSize: 18, fontWeight: 700 },
  row: { flexDirection: "row", gap: 8 },
  card: { flexGrow: 1, flexBasis: 0, padding: 7, borderWidth: 1, borderColor: COLORS.grid, borderRadius: 4 },
  cardTitle: { fontSize: 6.5, color: COLORS.muted, marginBottom: 3, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
});
