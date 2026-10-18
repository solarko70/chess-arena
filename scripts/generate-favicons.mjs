import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

// Standard CRC32
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0;
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawData, y * rowSize + 1, srcOffset, srcOffset + width * 4);
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToPolyline(px, py, poly, closed = true) {
  let minDist = Infinity;
  const n = poly.length;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const d = distToSegment(px, py, poly[i][0], poly[i][1], poly[j][0], poly[j][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function renderFaviconRgba(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Queen geometry in 100x100 coordinates
  const circles = [
    { cx: 22, cy: 28, r: 4 },
    { cx: 36, cy: 22, r: 4 },
    { cx: 50, cy: 18, r: 4.5 },
    { cx: 64, cy: 22, r: 4 },
    { cx: 78, cy: 28, r: 4 },
  ];

  const crownPoly = [
    [22, 34],
    [32, 64],
    [68, 64],
    [78, 34],
    [64, 52],
    [50, 30],
    [36, 52],
  ];

  const midPoly = [
    [32, 64],
    [30, 80],
    [70, 80],
    [68, 64],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      const nx = ((x + 0.5) / size) * 100;
      const ny = ((y + 0.5) / size) * 100;

      // 1. Background rounded rect: width 100, height 100, rx 20
      const rx = 20;
      const cx = Math.max(rx, Math.min(100 - rx, nx));
      const cy = Math.max(rx, Math.min(100 - rx, ny));
      const distFromCorner = Math.hypot(nx - cx, ny - cy);

      if (distFromCorner > rx + 0.5) {
        // Outside
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Background color: #f1d9b5 (241, 217, 181)
      let r = 241;
      let g = 217;
      let b = 181;
      let a = 255;

      if (distFromCorner > rx - 0.5) {
        // Antialiased outer edge
        const edgeAlpha = Math.max(0, Math.min(1, rx + 0.5 - distFromCorner));
        a = Math.round(255 * edgeAlpha);
      }

      // 2. Queen piece scaled by 0.9 and offset by (5, 5)
      const qx = (nx - 5) / 0.9;
      const qy = (ny - 5) / 0.9;

      let inQueenFill = false;
      let inQueenStroke = false;
      let inQueenDetail = false;

      // Base rect: x 20..80, y 80..90
      if (qx >= 20 && qx <= 80 && qy >= 80 && qy <= 90) {
        inQueenFill = true;
        if (qx <= 22 || qx >= 78 || qy <= 82 || qy >= 88) {
          inQueenStroke = true;
        }
      }

      // Mid body
      if (pointInPolygon(qx, qy, midPoly)) {
        inQueenFill = true;
        if (distToPolyline(qx, qy, midPoly, true) <= 2) {
          inQueenStroke = true;
        }
      }

      // Crown body
      if (pointInPolygon(qx, qy, crownPoly)) {
        inQueenFill = true;
        if (distToPolyline(qx, qy, crownPoly, true) <= 2.2) {
          inQueenStroke = true;
        }
      }

      // 5 Crown circles
      for (const c of circles) {
        const d = Math.hypot(qx - c.cx, qy - c.cy);
        if (d <= c.r) {
          inQueenFill = true;
          if (d >= c.r - 1.3) {
            inQueenStroke = true;
          }
        }
      }

      // Detail line: x 36..64, y 72
      if (qy >= 70.5 && qy <= 73.5 && qx >= 36 && qx <= 64) {
        inQueenDetail = true;
      }

      if (inQueenStroke) {
        // #334155
        r = 51;
        g = 65;
        b = 85;
      } else if (inQueenDetail) {
        // #64748b
        r = 100;
        g = 116;
        b = 139;
      } else if (inQueenFill) {
        // #f8fafc
        r = 248;
        g = 250;
        b = 252;
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  return buf;
}

// Generate 32x32 and 180x180 PNGs
const png32 = createPng(32, 32, renderFaviconRgba(32));
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);

const png180 = createPng(180, 180, renderFaviconRgba(180));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);

console.log('Generated favicon-32x32.png and apple-touch-icon.png successfully.');

