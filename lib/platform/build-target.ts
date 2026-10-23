/** True in the Capacitor build. Inlined at build time (next.config.js), so web and mobile render the same on server and client. */
export const isMobileBuild = process.env.NEXT_PUBLIC_BUILD_TARGET === "mobile";
