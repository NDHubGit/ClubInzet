/**
 * Genereert ClubInzet PWA-icons vanuit vector-SVG (donkerblauw + indigo/paars accent).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

/** Logo: kalender + team (3 figuren) — modern, minimaal */
const svgMain = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="55%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="metal" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="#020617"/>
  <g transform="translate(76 72)">
    <rect x="0" y="56" width="360" height="312" rx="32" fill="url(#accent)"/>
    <rect x="56" y="0" width="44" height="88" rx="14" fill="url(#metal)"/>
    <rect x="260" y="0" width="44" height="88" rx="14" fill="url(#metal)"/>
    <g opacity="0.22" fill="#020617">
      <rect x="40" y="160" width="72" height="56" rx="10"/>
      <rect x="144" y="160" width="72" height="56" rx="10"/>
      <rect x="248" y="160" width="72" height="56" rx="10"/>
      <rect x="40" y="244" width="72" height="56" rx="10"/>
      <rect x="144" y="244" width="72" height="56" rx="10"/>
      <rect x="248" y="244" width="72" height="56" rx="10"/>
    </g>
    <g fill="#f8fafc">
      <circle cx="124" cy="128" r="22"/>
      <circle cx="180" cy="108" r="26"/>
      <circle cx="236" cy="128" r="22"/>
    </g>
    <g fill="#c7d2fe" opacity="0.9">
      <circle cx="124" cy="128" r="10"/>
      <circle cx="180" cy="108" r="11"/>
      <circle cx="236" cy="128" r="10"/>
    </g>
  </g>
</svg>`;

/**
 * Maskable: zelfde motief ~66% in het midden (safe area voor adaptive icons).
 */
const svgMaskable = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="accent2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="55%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="metal2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#020617"/>
  <g transform="translate(256 256) scale(0.66) translate(-256 -256)">
    <rect width="512" height="512" rx="108" fill="#020617"/>
    <g transform="translate(76 72)">
      <rect x="0" y="56" width="360" height="312" rx="32" fill="url(#accent2)"/>
      <rect x="56" y="0" width="44" height="88" rx="14" fill="url(#metal2)"/>
      <rect x="260" y="0" width="44" height="88" rx="14" fill="url(#metal2)"/>
      <g opacity="0.22" fill="#020617">
        <rect x="40" y="160" width="72" height="56" rx="10"/>
        <rect x="144" y="160" width="72" height="56" rx="10"/>
        <rect x="248" y="160" width="72" height="56" rx="10"/>
        <rect x="40" y="244" width="72" height="56" rx="10"/>
        <rect x="144" y="244" width="72" height="56" rx="10"/>
        <rect x="248" y="244" width="72" height="56" rx="10"/>
      </g>
      <g fill="#f8fafc">
        <circle cx="124" cy="128" r="22"/>
        <circle cx="180" cy="108" r="26"/>
        <circle cx="236" cy="128" r="22"/>
      </g>
      <g fill="#c7d2fe" opacity="0.9">
        <circle cx="124" cy="128" r="10"/>
        <circle cx="180" cy="108" r="11"/>
        <circle cx="236" cy="128" r="10"/>
      </g>
    </g>
  </g>
</svg>`;

async function main() {
  const bufMain = Buffer.from(svgMain);
  const bufMask = Buffer.from(svgMaskable);

  await sharp(bufMain).png({ compressionLevel: 9 }).resize(192, 192).toFile(join(iconsDir, "icon-192.png"));
  await sharp(bufMain).png({ compressionLevel: 9 }).resize(512, 512).toFile(join(iconsDir, "icon-512.png"));
  await sharp(bufMask).png({ compressionLevel: 9 }).resize(512, 512).toFile(join(iconsDir, "icon-maskable.png"));

  console.log("OK:", join(iconsDir, "icon-192.png"));
  console.log("OK:", join(iconsDir, "icon-512.png"));
  console.log("OK:", join(iconsDir, "icon-maskable.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
