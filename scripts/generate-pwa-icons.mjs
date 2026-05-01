import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const NAVY = "#0D1B2A";
const GOLD = "#C9A84C";
const CRIMSON = "#8B1E1E";
const CREAM = "#F5E6D3";

function wordmarkSvg(size, { maskable = false } = {}) {
  // Maskable needs an 80% safe zone — scale the artwork down inside the safe area.
  const safeScale = maskable ? 0.80 : 1;
  const wordmarkSize = size * 0.24 * safeScale;
  const wordmarkY = size * 0.56;
  const ruleW = size * 0.32 * safeScale;
  const ruleX = (size - ruleW) / 2;
  const topRuleY = size * (maskable ? 0.34 : 0.32);
  const bottomRuleY = size * (maskable ? 0.68 : 0.70);
  const stripeH = maskable ? 0 : size * 0.012;
  const stripeY = size - stripeH;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${NAVY}"/>
  <line x1="${ruleX}" y1="${topRuleY}" x2="${ruleX + ruleW}" y2="${topRuleY}" stroke="${GOLD}" stroke-width="${size * 0.005}"/>
  <text x="${size / 2}" y="${wordmarkY}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="${wordmarkSize}" fill="${GOLD}" text-anchor="middle" letter-spacing="${wordmarkSize * 0.04}">PENS</text>
  <line x1="${ruleX}" y1="${bottomRuleY}" x2="${ruleX + ruleW}" y2="${bottomRuleY}" stroke="${GOLD}" stroke-width="${size * 0.005}"/>
  ${stripeH ? `<rect x="0" y="${stripeY}" width="${size}" height="${stripeH}" fill="${CRIMSON}"/>` : ""}
</svg>`;
}

async function render(svg, outPath) {
  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(outPath);
  console.log("wrote", outPath);
}

async function main() {
  mkdirSync(PUBLIC, { recursive: true });
  await render(wordmarkSvg(192), join(PUBLIC, "icon-192.png"));
  await render(wordmarkSvg(512), join(PUBLIC, "icon-512.png"));
  await render(wordmarkSvg(512, { maskable: true }), join(PUBLIC, "icon-512-maskable.png"));
  await render(wordmarkSvg(180), join(PUBLIC, "apple-touch-icon.png"));
  await render(wordmarkSvg(32), join(PUBLIC, "favicon-32.png"));
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
