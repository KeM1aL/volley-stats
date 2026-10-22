import type { CapacitorConfig } from '@capacitor/cli';

// CAP_DEV_HTTP=1 is for local development only: it lets the app reach a web server over plain HTTP
// (the Android emulator sees the PC at http://10.0.2.2:<port>). Never set it for a release build.
const devHttp = process.env.CAP_DEV_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.volleystats.app',
  appName: 'VolleyStats',
  webDir: 'out',
  ...(devHttp ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {}),
};

export default config;
