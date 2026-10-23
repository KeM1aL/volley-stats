/**
 * Inline script for <head> in the mobile build. Capacitor injects `window.Capacitor` into the WebView before page scripts run, so this marks <html> with
 * `data-native-app="ios|android"` before the first paint and CSS (globals.css) can hide the web header, which React only removes after mount (`useNativeApp`).
 * Plain JS with no imports, reading `window.Capacitor` at runtime (no @capacitor/* import); never throws. In a browser nothing is set.
 */
export const NATIVE_BOOT_SCRIPT = `try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()){var p=c.getPlatform();if(p==="ios"||p==="android")document.documentElement.dataset.nativeApp=p}}catch(e){}`;
