// Builds the source images for the app icon and the splash screen from public/logo.png:
// only the ball on the logo's navy, never the lettering of the ring (the name is not part of the icon).
// `pnpm app:assets` runs this, then @capacitor/assets turns the images into the native resources.
// Notes: the package.json script passes --android --ios on purpose (without them the tool also writes a PWA
// `icons/` folder and `public/manifest.webmanifest` into the repo), and the tool reformats
// android/app/src/main/AndroidManifest.xml: revert it after a run (`git checkout android/app/src/main/AndroidManifest.xml`).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logo = path.join(root, "public", "logo.png");
const out = path.join(root, "assets");

// The ball: centre and outer radius of its black outline, measured on the 2048x2048 logo.
const BALL = { cx: 1030, cy: 1024, radius: 363 };
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

async function navyOfRing() {
  const { data } = await sharp(logo)
    .extract({ left: 1024, top: 150, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

/** The ball alone, cut along the outside of its outline, scaled to `diameter` px, transparent around it. */
async function ball(diameter) {
  const size = BALL.radius * 2;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${BALL.radius}" cy="${BALL.radius}" r="${BALL.radius}" fill="#fff"/></svg>`,
  );
  const cut = await sharp(logo)
    .extract({ left: BALL.cx - BALL.radius, top: BALL.cy - BALL.radius, width: size, height: size })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(cut).resize(diameter, diameter, { kernel: "lanczos3" }).png().toBuffer();
}

/** A square of `size` px filled with `background`, the ball centred at `share` of the width (null background: transparent). */
async function compose(size, share, background, name, { flatten = false } = {}) {
  const diameter = Math.round(size * share);
  const offset = Math.round((size - diameter) / 2);
  let image = sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: await ball(diameter), left: offset, top: offset }]);
  if (flatten) image = image.flatten({ background }).removeAlpha();
  await image.png().toFile(path.join(out, name));
  console.log(`assets/${name}`);
}

const navy = await navyOfRing();
const solid = { ...navy, alpha: 1 };
await mkdir(out, { recursive: true });

await compose(ICON_SIZE, 0.7, solid, "icon-only.png", { flatten: true });
await compose(ICON_SIZE, 0.55, null, "icon-foreground.png");
await sharp({ create: { width: ICON_SIZE, height: ICON_SIZE, channels: 3, background: navy } })
  .png()
  .toFile(path.join(out, "icon-background.png"));
console.log("assets/icon-background.png");
await compose(SPLASH_SIZE, 0.2, solid, "splash.png", { flatten: true });
await compose(SPLASH_SIZE, 0.2, solid, "splash-dark.png", { flatten: true });
console.log(`navy rgb(${navy.r}, ${navy.g}, ${navy.b}) #${[navy.r, navy.g, navy.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
