// The implementation is chosen at build time: @platform-impl points at ./web or ./mobile (next.config.js).
export { platform } from "@platform-impl";
export type { BuildTarget, Platform } from "./types";
