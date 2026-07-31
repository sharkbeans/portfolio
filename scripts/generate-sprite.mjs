#!/usr/bin/env node
/**
 * NOTE: public/assets/sprites/player.png is currently sourced from a cropped
 * fan sprite sheet (see player.json's "provenance" field), not from this
 * script. Re-running this file will overwrite that with the procedural art
 * described below — don't run it unless that's what you want.
 *
 * Generates an original, license-clean top-down player sprite sheet as a raw
 * RGBA PNG (no image dependency — hand-rolled PNG encoding via node:zlib).
 * Chibi design inspired by Solid Snake's silhouette (blue-gray tactical
 * suit, near-black gloves/boots/harness, brown hair + dark headband) —
 * original pixel art, not traced or copied from any Konami or fan asset.
 *
 * Layout: 4 columns (walk frames) x 4 rows (down, left, right, up), 16x16px
 * per frame, 64x64px sheet total. Frame 0 in each row doubles as the idle
 * pose for that direction.
 *
 * Run: node scripts/generate-sprite.mjs
 * Output: public/assets/sprites/player.png + public/assets/sprites/player.json
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "assets", "sprites");

const FRAME = 16;
const COLS = 4;
const DIRECTIONS = ["down", "left", "right", "up"];
const ROWS = DIRECTIONS.length;
const WIDTH = FRAME * COLS;
const HEIGHT = FRAME * ROWS;

const OUTLINE = [8, 8, 8, 255];
const SKIN = [222, 178, 138, 255];
const SHIRT = [85, 91, 104, 255]; // blue-gray tactical suit
const SHIRT_SHADE = [60, 66, 72, 255];
const VEST = [39, 43, 50, 255]; // dark harness straps across the chest
const PANTS = [28, 30, 34, 255]; // near-black tactical trousers
const BOOT = [16, 17, 19, 255]; // near-black boot, slightly darker for cuff contrast
const HAIR = [122, 77, 39, 255]; // brown hair
const BANDANA = [51, 34, 20, 255]; // dark brown headband
const GLOVE = [30, 33, 37, 255]; // near-black tactical gloves
const EYE = [17, 17, 17, 255];

const buffer = new Uint8Array(WIDTH * HEIGHT * 4);

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  buffer[i] = color[0];
  buffer[i + 1] = color[1];
  buffer[i + 2] = color[2];
  buffer[i + 3] = color[3];
}

function fillRect(ox, oy, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(ox + x + dx, oy + y + dy, color);
    }
  }
}

function blockWithOutline(ox, oy, x, y, w, h, color) {
  fillRect(ox, oy, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  fillRect(ox, oy, x, y, w, h, color);
}

/**
 * Draws one 16x16 frame at sheet-pixel origin (ox, oy).
 * walkPhase: 0 = neutral stance (also the idle pose), 1 = left leg forward,
 * 2 = neutral, 3 = right leg forward.
 */
function drawFrame(ox, oy, direction, walkPhase) {
  const legShift = walkPhase === 1 ? -1 : walkPhase === 3 ? 1 : 0;

  // Legs (drawn first, body sits on top), with a tan boot cuff at the ankle
  const leftLegY = 12 + Math.max(0, -legShift);
  const rightLegY = 12 + Math.max(0, legShift);
  blockWithOutline(ox, oy, 5, leftLegY, 2, 3, PANTS);
  blockWithOutline(ox, oy, 9, rightLegY, 2, 3, PANTS);
  fillRect(ox, oy, 5, leftLegY + 2, 2, 1, BOOT);
  fillRect(ox, oy, 9, rightLegY + 2, 2, 1, BOOT);

  // Body / sneaking suit, shaded when facing sideways
  const bodyColor = direction === "left" || direction === "right" ? SHIRT_SHADE : SHIRT;
  blockWithOutline(ox, oy, 4, 7, 8, 5, bodyColor);
  // Tan chest pouch
  fillRect(ox, oy, 6, 9, 4, 2, VEST);

  // Arms: swing opposite to the forward leg (fingerless gloves)
  const armShift = walkPhase === 1 ? 1 : walkPhase === 3 ? -1 : 0;
  blockWithOutline(ox, oy, 3, 8 + Math.max(0, armShift), 1, 3, GLOVE);
  blockWithOutline(ox, oy, 12, 8 + Math.max(0, -armShift), 1, 3, GLOVE);

  // Head + face, direction-dependent
  if (direction === "up") {
    blockWithOutline(ox, oy, 4, 1, 8, 6, HAIR);
    // Bandana tails trailing at the nape
    fillRect(ox, oy, 6, 7, 1, 2, BANDANA);
    fillRect(ox, oy, 9, 7, 1, 2, BANDANA);
  } else if (direction === "down") {
    blockWithOutline(ox, oy, 4, 1, 8, 3, HAIR);
    blockWithOutline(ox, oy, 5, 3, 6, 4, SKIN);
    fillRect(ox, oy, 5, 2, 6, 1, BANDANA);
    setPixel(ox + 6, oy + 5, EYE);
    setPixel(ox + 9, oy + 5, EYE);
  } else {
    // left / right profile: shift head toward the facing side
    const dx = direction === "left" ? -1 : 1;
    blockWithOutline(ox, oy, 4 + dx, 1, 8, 3, HAIR);
    blockWithOutline(ox, oy, 5 + dx, 3, 6, 4, SKIN);
    fillRect(ox, oy, 5 + dx, 2, 6, 1, BANDANA);
    setPixel(ox + (direction === "left" ? 6 : 9) + dx, oy + 5, EYE);
  }
}

for (let row = 0; row < ROWS; row++) {
  const direction = DIRECTIONS[row];
  const phases = [0, 1, 0, 3];
  for (let col = 0; col < COLS; col++) {
    drawFrame(col * FRAME, row * FRAME, direction, phases[col]);
  }
}

// --- Hand-rolled PNG encoding (RGBA, no interlace, filter type 0 per row) ---

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));
for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (1 + WIDTH * 4);
  raw[rowStart] = 0; // filter type: None
  const pixelRowStart = y * WIDTH * 4;
  raw.set(buffer.subarray(pixelRowStart, pixelRowStart + WIDTH * 4), rowStart + 1);
}

const idatData = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", idatData),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(join(outDir, "player.png"), png);

const anims = {};
for (const direction of DIRECTIONS) {
  const rowIndex = DIRECTIONS.indexOf(direction);
  anims[`idle-${direction}`] = { from: rowIndex * COLS, to: rowIndex * COLS, loop: false };
  anims[`walk-${direction}`] = {
    from: rowIndex * COLS,
    to: rowIndex * COLS + (COLS - 1),
    loop: true,
    speed: 8,
  };
}

const metadata = {
  file: "player.png",
  frameWidth: FRAME,
  frameHeight: FRAME,
  sliceX: COLS,
  sliceY: ROWS,
  directions: DIRECTIONS,
  anims,
  license:
    "Original pixel art generated for this project (silhouette inspired by Solid Snake, not traced/copied from any Konami asset). Public domain / CC0 — replace freely.",
};

writeFileSync(join(outDir, "player.json"), JSON.stringify(metadata, null, 2));

console.log(`Wrote ${WIDTH}x${HEIGHT} sprite sheet to ${join(outDir, "player.png")}`);
