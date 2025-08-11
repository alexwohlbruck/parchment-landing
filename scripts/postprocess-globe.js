#!/usr/bin/env node
import fs from 'fs';
import { PNG } from 'pngjs';

const inPath = process.env.IN || 'public/textures/globe/earth_albedo.png';
const outPath = process.env.OUT || inPath;
const posterizeLevels = parseInt(process.env.POSTERIZE || '0', 10);
const noiseAmp = parseFloat(process.env.NOISE || '0');
const satBoost = parseFloat(process.env.SAT || '1.0');
const bright = parseFloat(process.env.BRIGHT || '1.0');
const maskPath = process.env.DESERT_MASK || '';
const maskColorHex = process.env.DESERT_HEX || '#FFE6E0';
const maskBlend = parseFloat(process.env.MASK_BLEND || '1.0'); // 1.0 = replace, 0.5 = tint

function clamp(x, a = 0, b = 255) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function loadPng(path) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(path).pipe(new PNG()).on('parsed', function () { resolve(this); }).on('error', reject);
  });
}

(async () => {
  const img = await loadPng(inPath);
  let mask = null;
  if (maskPath && fs.existsSync(maskPath)) {
    try { mask = await loadPng(maskPath); } catch { }
  }

  const data = img.data;
  const maskRGB = hexToRgb(maskColorHex);
  // Simple PRNG for stable noise
  let seed = 1337; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

    // Mask recolor first (e.g., deserts)
    if (mask && mask.width === img.width && mask.height === img.height) {
      const mA = mask.data[i + 3];
      if (mA > 10) {
        r = clamp(lerp(r, maskRGB.r, maskBlend));
        g = clamp(lerp(g, maskRGB.g, maskBlend));
        b = clamp(lerp(b, maskRGB.b, maskBlend));
      }
    }

    // brightness
    r = clamp(r * bright); g = clamp(g * bright); b = clamp(b * bright);
    // saturation boost (approx)
    const avg = (r + g + b) / 3;
    r = clamp(lerp(avg, r, satBoost));
    g = clamp(lerp(avg, g, satBoost));
    b = clamp(lerp(avg, b, satBoost));
    // posterize
    if (posterizeLevels > 1) {
      const q = (v) => Math.round((Math.round((v / 255) * (posterizeLevels - 1))) / (posterizeLevels - 1) * 255);
      r = q(r); g = q(g); b = q(b);
    }
    // grain
    if (noiseAmp > 0) {
      const n = (rnd() * 2 - 1) * 255 * noiseAmp;
      r = clamp(r + n); g = clamp(g + n); b = clamp(b + n);
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }

  await new Promise(res => img.pack().pipe(fs.createWriteStream(outPath)).on('finish', res));
  console.log(`Wrote ${outPath}`);
})(); 