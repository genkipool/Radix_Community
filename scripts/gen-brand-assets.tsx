/**
 * gen-brand-assets.tsx rasterises the brand mark into the icon files that
 * crawlers and mobile OSes need.
 *
 * `app/icon.svg` alone is not enough: Google Search does not render SVG
 * favicons and iOS screenshots the page when there is no apple-touch-icon.
 * Everything here is derived from that same SVG so the mark can only ever be
 * changed in one place. Social cards are drawn per route at runtime instead,
 * in `lib/og-card.tsx`.
 *
 * Run with:  pnpm gen:brand-assets
 * The output is committed: this is a design-time script, not a build step.
 */
import { ImageResponse } from 'next/og';
import fs from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const APP_DIR = path.join(process.cwd(), 'app');

const BRAND_FROM = '#052CC0';
const BRAND_TO = '#3B6BF5';

/**
 * The mark, as a standalone SVG string. `rounded` fills the whole square
 * instead of a circle, because iOS applies its own mask to apple-touch-icon, so a
 * circular source would end up clipped twice.
 */
function markSvg(rounded: boolean): string {
    const shape = rounded
        ? '<rect x="0" y="0" width="200" height="200" fill="url(#bg)"/>'
        : '<circle cx="100" cy="100" r="98" fill="url(#bg)" stroke-width="0"/>';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${BRAND_FROM}" />
      <stop offset="100%" stop-color="${BRAND_TO}" />
    </linearGradient>
  </defs>
  ${shape}
  <g transform="translate(44, 63) scale(0.5)">
    <path d="M0,91.1 L38.35,91.1 L85.85,158.1 L155.45,11 L223.9,11"
      fill="none" stroke="white" stroke-width="22.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

function markDataUri(rounded: boolean): string {
    return `data:image/svg+xml;base64,${Buffer.from(markSvg(rounded)).toString('base64')}`;
}

async function render(element: React.ReactElement, width: number, height: number) {
    const response = new ImageResponse(element, { width, height });
    return Buffer.from(await response.arrayBuffer());
}

/** Square icon: the mark, edge to edge. */
function iconElement(rounded: boolean) {
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={markDataUri(rounded)} width="100%" height="100%" alt="" />
        </div>
    );
}

/**
 * Wraps a PNG in an ICO container. The ICO format has allowed a raw PNG
 * payload since Vista, so no bitmap re-encoding is needed, just the 6-byte
 * header and the 16-byte directory entry pointing at the PNG.
 */
function pngToIco(png: Buffer, size: number): Buffer {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: icon
    header.writeUInt16LE(1, 4); // image count

    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

    return Buffer.concat([header, entry, png]);
}

async function write(file: string, data: Buffer) {
    await fs.writeFile(file, data);
    console.log(`  ${path.relative(process.cwd(), file).padEnd(32)} ${(data.length / 1024).toFixed(1)} KB`);
}

async function main() {
    console.log('Generating brand assets…');

    const [icon32, icon180, icon192, icon512] = await Promise.all([
        render(iconElement(false), 32, 32),
        render(iconElement(true), 180, 180),
        render(iconElement(false), 192, 192),
        render(iconElement(false), 512, 512),
    ]);

    // app/ uses Next's file conventions, so these are wired into <head>
    // automatically, with no `metadata.icons` entry needed.
    await write(path.join(APP_DIR, 'favicon.ico'), pngToIco(icon32, 32));
    await write(path.join(APP_DIR, 'icon.png'), icon192);
    await write(path.join(APP_DIR, 'apple-icon.png'), icon180);

    // public/ holds what the web manifest and the metadata helper reference.
    await write(path.join(PUBLIC_DIR, 'icon-192.png'), icon192);
    await write(path.join(PUBLIC_DIR, 'icon-512.png'), icon512);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
