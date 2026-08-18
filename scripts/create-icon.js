const fs = require('fs');
const path = require('path');

// Create a simple 128x128 PNG using raw pixels
// This creates a minimal valid PNG file
function createPNG(width, height, pixels) {
  const { createDeflateRaw } = require('zlib');
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrCRC = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdrData.copy(ihdr, 8);
  ihdr.writeUInt32BE(ihdrCRC, 21);
  
  // Raw image data (RGB, no filter)
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const offset = y * (1 + width * 3) + 1 + x * 3;
      raw[offset] = pixels[idx];
      raw[offset + 1] = pixels[idx + 1];
      raw[offset + 2] = pixels[idx + 2];
    }
  }
  
  // Compress with deflate
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw);
  
  // IDAT chunk
  const idatCRC = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  idat.writeUInt32BE(idatCRC, 8 + compressed.length);
  
  // IEND chunk
  const iendCRC = crc32(Buffer.from('IEND'));
  const iend = Buffer.from([0,0,0,0, 73,69,78,68, 0,0,0,0]);
  iend.writeUInt32BE(iendCRC, 8);
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xEDB88320;
      else crc = crc >>> 1;
    }
  }
  return (crc ^ (-1)) >>> 0;
}

// Draw the icon
const W = 128, H = 128;
const pixels = Buffer.alloc(W * H * 3);

function setPixel(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const idx = (y * W + x) * 3;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
}

function fillCircle(cx, cy, radius, r, g, b) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        setPixel(Math.round(x), Math.round(y), r, g, b);
      }
    }
  }
}

function fillRect(x, y, w, h, r, g, b) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x + dx, y + dy, r, g, b);
    }
  }
}

function fillRoundRect(x, y, w, h, radius, r, g, b) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      let inShape = true;
      // Check corners
      if (dx < radius && dy < radius) {
        inShape = (dx - radius) ** 2 + (dy - radius) ** 2 <= radius ** 2;
      } else if (dx >= w - radius && dy < radius) {
        inShape = (dx - (w - radius - 1)) ** 2 + (dy - radius) ** 2 <= radius ** 2;
      } else if (dx < radius && dy >= h - radius) {
        inShape = (dx - radius) ** 2 + (dy - (h - radius - 1)) ** 2 <= radius ** 2;
      } else if (dx >= w - radius && dy >= h - radius) {
        inShape = (dx - (w - radius - 1)) ** 2 + (dy - (h - radius - 1)) ** 2 <= radius ** 2;
      }
      if (inShape) setPixel(x + dx, y + dy, r, g, b);
    }
  }
}

function fillLine(x1, y1, x2, y2, thickness, r, g, b) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    fillCircle(Math.round(x), Math.round(y), Math.ceil(thickness / 2), r, g, b);
  }
}

// Background - dark rounded rect
fillRoundRect(0, 0, W, H, 16, 13, 17, 23);

// Blue circle (top-left node) - Engineering
fillCircle(36, 36, 20, 79, 156, 249);

// Purple square (top-right node) - OS
fillRoundRect(78, 16, 40, 40, 6, 188, 140, 255);

// Green diamond (bottom node) - System
const dcx = 64, dcy = 92, dr = 22;
for (let y = dcy - dr; y <= dcy + dr; y++) {
  for (let x = dcx - dr; x <= dcx + dr; x++) {
    if (Math.abs(x - dcx) + Math.abs(y - dcy) <= dr) {
      setPixel(Math.round(x), Math.round(y), 63, 185, 80);
    }
  }
}

// Connection lines
fillLine(54, 36, 78, 36, 3, 79, 156, 249);   // blue to purple
fillLine(44, 52, 56, 74, 3, 63, 185, 80);     // blue to green
fillLine(86, 56, 72, 74, 3, 188, 140, 255);   // purple to green

// White dots at nodes
fillCircle(36, 36, 4, 255, 255, 255);
fillCircle(98, 36, 4, 255, 255, 255);
fillCircle(64, 92, 4, 255, 255, 255);

// Gold corner dots
fillCircle(16, 16, 5, 210, 153, 34);
fillCircle(112, 16, 5, 210, 153, 34);
fillCircle(16, 112, 5, 210, 153, 34);
fillCircle(112, 112, 5, 210, 153, 34);

// Write PNG
const png = createPNG(W, H, pixels);
const outPath = path.join(__dirname, '..', 'media', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Created ${outPath} (${png.length} bytes)`);
