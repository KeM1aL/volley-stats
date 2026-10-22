/** What the app needs from `window`: Chromium's Navigation API when present, the history length otherwise. */
export interface HistoryEnv {
  navigation?: { canGoBack?: boolean };
  history: { length: number };
}

/**
 * Whether going back stays inside the app. `navigation.canGoBack` (Android WebView 102+, iOS 26+) knows the position in the
 * history; `history.length` also counts the entries ahead after a back, so it is only the fallback for older web views.
 */
export function canGoBackIn({ navigation, history }: HistoryEnv): boolean {
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;
  return history.length > 1;
}
