#!/usr/bin/env node

/*
  Render an equirectangular PNG "screenshot" of Mapbox GL 3.x Standard style
  - Uses mbgl-renderer to render a global Web Mercator image
  - Hides administrative boundary layers (keeps labels)
  - Warps to EPSG:4326 (2:1 equirectangular) with GDAL

  Requirements:
  - env MAPBOX_TOKEN or --token argument
  - gdal_translate and gdalwarp available on PATH

  Usage:
    node mapbox-render.js \
      --out ../../public/textures/globe/earth_albedo.png \
      --width 2048 --height 1024 \
      --mercator 4096 \
      --style mapbox://styles/mapbox/streets-v12 \
      [--token YOUR_TOKEN]

  Defaults:
    --out       ../../public/textures/globe/earth_albedo.png
    --width     4096   (final equirectangular width)
    --height    2048   (final equirectangular height)
    --mercator  8192   (intermediate square Mercator size)
    --style     mapbox://styles/mapbox/streets-v12
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');
const render = require('mbgl-renderer').default || require('mbgl-renderer');

function parseArgs(argv) {
  const args = {
    out: path.resolve(__dirname, '../../public/textures/globe/earth_albedo.png'),
    width: 4096,
    height: 2048,
    mercator: 8192,
    style: 'mapbox://styles/mapbox/streets-v12',
    token: process.env.MAPBOX_TOKEN || process.env.MAPBOX_API_TOKEN || '',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--width') args.width = parseInt(argv[++i], 10);
    else if (a === '--height') args.height = parseInt(argv[++i], 10);
    else if (a === '--mercator') args.mercator = parseInt(argv[++i], 10);
    else if (a === '--style') args.style = argv[++i];
    else if (a === '--no-fallback') args.noFallback = true;
    else if (a === '--token') args.token = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node mapbox-render.js --out <file.png> --width 2048 --height 1024 --mercator 4096 --style mapbox://styles/mapbox/streets-v12 [--token <token>]'
      );
      process.exit(0);
    }
  }
  return args;
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function isStandardStyle(style) {
  // Heuristics: presence of imports/config/slots typical of Mapbox Standard
  if (!style || typeof style !== 'object') return false;
  const hasImports = Array.isArray(style.imports) && style.imports.length > 0;
  const hasConfig = typeof style.config === 'object';
  const hasSlots = Array.isArray(style.slots) || typeof style.slots === 'object';
  return hasImports || hasConfig || hasSlots;
}

function resolveStyleApiUrl(styleUrl, token) {
  // Accepts: mapbox://styles/<user>/<style-id> or full https URL
  if (styleUrl.startsWith('http://') || styleUrl.startsWith('https://')) {
    return styleUrl.includes('access_token=')
      ? styleUrl
      : `${styleUrl}${styleUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
  }
  const match = styleUrl.match(/^mapbox:\/\/styles\/([^/]+)\/([^/?#]+)$/);
  if (!match) {
    throw new Error(`Unsupported style URL: ${styleUrl}`);
  }
  const user = match[1];
  const id = match[2];
  return `https://api.mapbox.com/styles/v1/${encodeURIComponent(user)}/${encodeURIComponent(id)}?access_token=${encodeURIComponent(
    token
  )}`;
}

function injectBackgroundIfMissing(style) {
  const hasBackground = (style.layers || []).some((l) => l.type === 'background');
  if (!hasBackground) {
    style.layers = style.layers || [];
    style.layers.unshift({ id: 'background', type: 'background', paint: { 'background-color': '#F8F9FB' } });
  }
}

function patchStyleForRenderer(style) {
  const cloned = JSON.parse(JSON.stringify(style));

  // Force mercator projection; remove 3.x features not supported by maplibre-native renderer
  cloned.projection = 'mercator';
  delete cloned.terrain;
  delete cloned.fog;
  delete cloned.camera;

  // Remove unsupported layers (e.g., sky)
  cloned.layers = (cloned.layers || []).filter((layer) => layer && layer.type !== 'sky');

  // Hide administrative boundary line layers only; keep labels (symbols)
  for (const layer of cloned.layers) {
    const id = (layer.id || '').toLowerCase();
    const isBoundary = /\b(admin|boundary)\b/.test(id);
    const looksBoundarySource = typeof layer['source-layer'] === 'string' && /\b(admin|boundary)\b/i.test(layer['source-layer']);
    const isLine = layer.type === 'line';
    if ((isBoundary || looksBoundarySource) && isLine) {
      layer.layout = layer.layout || {};
      layer.layout.visibility = 'none';
    }
  }

  // Hide place labels: symbol layers with typical place label ids or source-layers
  for (const layer of cloned.layers) {
    if (layer.type !== 'symbol') continue;
    const id = (layer.id || '').toLowerCase();
    const srcLayer = (layer['source-layer'] || '').toLowerCase();
    const looksPlace = /place|settlement|city|town|village|locality/.test(id) || /place|settlement|city|town|village|locality/.test(srcLayer);
    if (looksPlace) {
      layer.layout = layer.layout || {};
      layer.layout.visibility = 'none';
    }
  }

  // Hide road layers (lines and symbols) in classic styles
  for (const layer of cloned.layers) {
    const id = (layer.id || '').toLowerCase();
    const srcLayer = (layer['source-layer'] || '').toLowerCase();
    const roadRegex = /(\broad\b|motorway|trunk|primary|secondary|tertiary|street|highway|path|pedestrian|bridge|tunnel|roundabout|service)/;
    const looksRoad = roadRegex.test(id) || roadRegex.test(srcLayer);
    if (looksRoad) {
      layer.layout = layer.layout || {};
      layer.layout.visibility = 'none';
    }
  }

  // Ensure glyphs are present for labels; Mapbox hosted glyphs are fine with token
  if (!cloned.glyphs) {
    cloned.glyphs = 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf';
  }

  injectBackgroundIfMissing(cloned);

  return cloned;
}

async function renderMercatorPng(styleJson, size, token) {
  const bounds = [-180, -85.051129, 180, 85.051129];
  const options = { bounds, token };
  const data = await render(styleJson, size, size, options);
  return Buffer.from(data);
}

function runCmd(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
}

async function loadStyle(styleUrl, token) {
  const apiUrl = resolveStyleApiUrl(styleUrl, token);
  console.log(`Fetching style: ${apiUrl}`);
  const style = await fetchJson(apiUrl);
  return style;
}

async function main() {
  const { out, width, height, mercator, style: styleArg, token } = parseArgs(process.argv);
  if (!token) {
    console.error('MAPBOX_TOKEN is required (env MAPBOX_TOKEN or --token).');
    process.exit(1);
  }

  const style = await loadStyle(styleArg, token);

  console.log('Patching style for renderer (hide admin borders, remove unsupported layers, add background)...');
  const patched = patchStyleForRenderer(style);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbgl-'));
  const mercPng = path.join(tmpDir, 'world_mercator.png');

  console.log(`Rendering Mercator ${mercator}x${mercator} with mbgl-renderer...`);
  const pngBuf = await renderMercatorPng(patched, mercator, token);
  fs.writeFileSync(mercPng, pngBuf);

  // Reproject to equirectangular using GDAL
  ensureDir(out);
  const tifGeo = path.join(tmpDir, 'world_mercator.tif');
  const vrt4326 = path.join(tmpDir, 'world_4326.vrt');

  console.log('Georeferencing Mercator with gdal_translate...');
  runCmd('gdal_translate', [
    '-of', 'GTiff',
    '-a_srs', 'EPSG:3857',
    '-a_ullr', '-20037508.3427892', '20037508.3427892', '20037508.3427892', '-20037508.3427892',
    mercPng,
    tifGeo,
  ]);

  console.log('Warping to EPSG:4326 equirectangular with gdalwarp...');
  runCmd('gdalwarp', [
    '-t_srs', 'EPSG:4326',
    '-te', '-180', '-90', '180', '90',
    '-ts', String(width), String(height),
    '-r', 'bilinear',
    tifGeo,
    vrt4326,
  ]);

  console.log(`Writing PNG to ${out} with gdal_translate...`);
  runCmd('gdal_translate', ['-of', 'PNG', vrt4326, out]);

  console.log(`Done. Wrote ${out}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
