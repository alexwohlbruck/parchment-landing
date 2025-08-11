#!/usr/bin/env bash
# Render a stylized global albedo from Mapbox Vector Tiles using a headless renderer
# Pipeline:
# 1) Fetch Mapbox style JSON (or use hosted style URL)
# 2) Render a global Web Mercator image with mbgl-renderer (local or Docker)
# 3) Georeference and reproject to EPSG:4326 (equirectangular 2:1) with GDAL
# 4) Write outputs to public/textures/globe/earth_albedo.(png|webp)
#
# Requirements: MAPBOX_TOKEN env var, GDAL, and Node dependency "mbgl-renderer" (installed by bun install)
# Optional: jq (to patch colors), cwebp or ImageMagick for WebP

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.globe-data/mapbox"
OUT_DIR="$ROOT_DIR/public/textures/globe"
STYLE_JSON="$DATA_DIR/style-standard.json"

# Output resolution (final equirectangular 2:1)
FINAL_W=${FINAL_W:-2048}
FINAL_H=${FINAL_H:-1024}
# Intermediate Mercator canvas (square). Bigger -> sharper after warp
MERCATOR_SIZE=${MERCATOR_SIZE:-4096}
# Colors (hex) to override in style (best-effort; depends on style structure)
OCEAN_HEX=${OCEAN_HEX:-#3CC0FF}
GREEN_HEX=${GREEN_HEX:-#BEE376}
DESERT_HEX=${DESERT_HEX:-#FFE6E0}

[ -z "${MAPBOX_TOKEN:-}" ] && { echo "MAPBOX_TOKEN is required" >&2; exit 1; }

mkdir -p "$DATA_DIR" "$OUT_DIR"

fetch_style() {
  echo "↓ Fetching Mapbox standard style JSON"
  curl -sSLf "https://api.mapbox.com/styles/v1/mapbox/standard?access_token=${MAPBOX_TOKEN}" > "$STYLE_JSON"
}

patch_style_colors() {
  if command -v jq >/dev/null 2>&1; then
    echo "🎨 Attempting color patch (non-fatal)"
    set +e
    jq \
      --arg ocean "$OCEAN_HEX" \
      --arg green "$GREEN_HEX" \
      --arg desert "$DESERT_HEX" \
      '(
        .layers |= (
          map(
            if (.id|test("water|ocean")) and (.paint["fill-color"] != null) then (.paint["fill-color"]=$ocean)
            elif (.id|test("landcover|landuse|park")) and (.paint["fill-color"] != null) then (.paint["fill-color"]=$green)
            elif (.id|test("sand|desert|bare_rock")) and (.paint["fill-color"] != null) then (.paint["fill-color"]=$desert)
            else . end
          )
        )
      )' "$STYLE_JSON" > "$STYLE_JSON.tmp"
    if [ $? -eq 0 ]; then mv "$STYLE_JSON.tmp" "$STYLE_JSON"; else rm -f "$STYLE_JSON.tmp"; fi
    set -e
  fi
}

have_local_mbgl() { [ -x "$ROOT_DIR/node_modules/.bin/mbgl-render" ]; }

render_mercator() {
  echo "🖼️  Rendering world mercator ${MERCATOR_SIZE}x${MERCATOR_SIZE}"
  local IMG_MERC="$DATA_DIR/world_mercator.png"
  # Bounds WSEN in degrees, clamped to mercator limits
  local BOUNDS="-180,-85.051129,180,85.051129"
  if have_local_mbgl; then
    if "$ROOT_DIR/node_modules/.bin/mbgl-render" "$STYLE_JSON" "$IMG_MERC" "$MERCATOR_SIZE" "$MERCATOR_SIZE" -b "$BOUNDS" --token "$MAPBOX_TOKEN"; then
      echo "$IMG_MERC"; return
    fi
  fi
  echo "🐳 Falling back to Docker renderer"
  docker run --rm \
    -e MAPBOX_API_TOKEN="$MAPBOX_TOKEN" \
    -v "$DATA_DIR:/data" \
    ghcr.io/consbio/mbgl-renderer:latest \
    mbgl-render /data/$(basename "$STYLE_JSON") /data/world_mercator.png "$MERCATOR_SIZE" "$MERCATOR_SIZE" -b "$BOUNDS" --token "$MAPBOX_TOKEN"
  echo "$IMG_MERC"
}

reproject_to_equirectangular() {
  local SRC_IMG="$1"
  local TIF_GEO="$DATA_DIR/world_mercator.tif"
  local VRT4326="$DATA_DIR/world_4326.vrt"
  local OUT_PNG="$OUT_DIR/earth_albedo.png"

  echo "🗺️  Georeferencing mercator and warping to EPSG:4326"
  # Assign mercator georeference covering world
  gdal_translate -of GTiff -a_srs EPSG:3857 -a_ullr -20037508.3427892 20037508.3427892 20037508.3427892 -20037508.3427892 "$SRC_IMG" "$TIF_GEO"
  # Warp to equirectangular 2:1
  gdalwarp -t_srs EPSG:4326 -te -180 -90 180 90 -ts "$FINAL_W" "$FINAL_H" -r bilinear "$TIF_GEO" "$VRT4326"
  gdal_translate -of PNG "$VRT4326" "$OUT_PNG"

  # WebP (smaller)
  if command -v cwebp >/dev/null 2>&1; then
    cwebp -q 85 "$OUT_PNG" -o "$OUT_DIR/earth_albedo.webp" >/dev/null 2>&1 || true
  elif command -v magick >/dev/null 2>&1; then
    magick "$OUT_PNG" -quality 85 "$OUT_DIR/earth_albedo.webp" || true
  fi

  echo "✅ Wrote $OUT_PNG"
}

main() {
  fetch_style
  patch_style_colors || true
  local merc_png
  merc_png=$(render_mercator)
  reproject_to_equirectangular "$merc_png"
}

main "$@" 