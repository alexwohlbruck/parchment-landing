#!/usr/bin/env bash
# Lightweight globe texture builder
# - Produces equirectangular (EPSG:4326) albedo, roughness, and bump maps
# - Uses NOAA ETOPO1 (global elevation+bathymetry) and an adjustable color ramp
# - Outputs go to public/textures/globe

set -euo pipefail

# ----- Config -----
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.globe-data"
OUT_DIR="$ROOT_DIR/public/textures/globe"
COLORS_FILE="${COLORS_FILE:-$ROOT_DIR/scripts/colors-parchment.txt}"

# Default output size (2:1). Smaller for perf; override via env
SIZE_W="${SIZE_W:-4096}"
SIZE_H="${SIZE_H:-2048}"
# Roughness and bump scales relative to albedo size (e.g., 0.5 = half-res)
ROUGHNESS_SCALE="${ROUGHNESS_SCALE:-0.5}"
BUMP_SCALE="${BUMP_SCALE:-0.5}"
# Clouds processing (input: public/textures/clouds.png)
CLOUDS_MAX="${CLOUDS_MAX:-2048}" # max width for downscaled clouds

# ETOPO1 (grid-registered, EPSG:4326)
ETOPO_ZIP_URL="https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO1/data/ice_surface/grid_registered/georeferenced_tiff/ETOPO1_Ice_g_geotiff.zip"
ETOPO_ZIP="$DATA_DIR/ETOPO1_Ice_g_geotiff.zip"
ETOPO_TIF="$DATA_DIR/ETOPO1.tif"

# Natural Earth (land + deserts)
NE_BASE_P="https://naciscdn.org/naturalearth/10m/physical"
NE_LAND_ZIP="$DATA_DIR/ne_10m_land.zip"
NE_LAND_DIR="$DATA_DIR/ne_10m_land"
# Try multiple candidates for desert polygons
NE_DESERT_ZIPS=(
  "$DATA_DIR/ne_10m_geography_regions_polys.zip"
  "$DATA_DIR/ne_10m_physical_label_areas.zip"
)
NE_DESERT_URLS=(
  "https://naciscdn.org/naturalearth/10m/physical/ne_10m_geography_regions_polys.zip"
  "https://naciscdn.org/naturalearth/10m/physical/ne_10m_physical_label_areas.zip"
)
NE_DESERT_DIR="$DATA_DIR/ne_10m_desert_src"

# Colors
DESERT_HEX="${DESERT_HEX:-#FFE6E0}"
OCEAN_HEX="${OCEAN_HEX:-#3CC0FF}"
GREEN_HEX="${GREEN_HEX:-#BEE376}"

# ----- Helpers -----
cmd_exists() { command -v "$1" >/dev/null 2>&1; }

require_tools() {
  local missing=0
  for t in gdalinfo gdaldem gdal_translate gdalwarp gdal_rasterize; do
    if ! cmd_exists "$t"; then echo "Missing: $t" >&2; missing=1; fi
  done
  if [ "$missing" = 1 ]; then
    echo "Install GDAL (macOS: brew install gdal)" >&2
    exit 1
  fi
  if ! cmd_exists magick && ! cmd_exists convert; then
    echo "ImageMagick not found (optional compositing)." >&2
  fi
}

fetch() {
  local url="$1" dest="$2"
  if [ -f "$dest" ]; then
    echo "✓ Exists: $(basename "$dest")"
    return 0
  fi
  echo "↓ Downloading $(basename "$dest")"
  if ! curl -L --fail --retry 3 --retry-delay 2 "$url" -o "$dest"; then
    echo "⚠️  Failed: $url" >&2
    return 1
  fi
}

unzip_if_needed() {
  local zip="$1" outdir="$2"
  if [ -d "$outdir" ]; then
    echo "✓ Unzipped: $(basename "$outdir")"
    return
  fi
  mkdir -p "$outdir"
  echo "↺ Unzipping $(basename "$zip")"
  unzip -q "$zip" -d "$outdir"
}

prepare_etopo() {
  fetch "$ETOPO_ZIP_URL" "$ETOPO_ZIP"
  local unzip_dir="$DATA_DIR/etopo_zip"
  unzip_if_needed "$ETOPO_ZIP" "$unzip_dir"
  if [ ! -f "$ETOPO_TIF" ]; then
    local tif
    tif=$(find "$unzip_dir" -type f -name "*.tif" | head -n1 || true)
    [ -z "$tif" ] && { echo "GeoTIFF not found in $unzip_dir" >&2; exit 1; }
    cp "$tif" "$ETOPO_TIF"
  fi
}

prepare_natural_earth() {
  fetch "$NE_BASE_P/ne_10m_land.zip" "$NE_LAND_ZIP" || true
  [ -f "$NE_LAND_ZIP" ] && unzip_if_needed "$NE_LAND_ZIP" "$NE_LAND_DIR"

  mkdir -p "$NE_DESERT_DIR"
  local got=0
  for i in ${!NE_DESERT_URLS[@]}; do
    local url="${NE_DESERT_URLS[$i]}" zip="${NE_DESERT_ZIPS[$i]}"
    local subdir="$NE_DESERT_DIR/$i"
    if fetch "$url" "$zip"; then
      unzip_if_needed "$zip" "$subdir" || true
      got=1
    fi
  done
  if [ "$got" = 0 ]; then
    echo "⚠️  Could not download deserts source; continuing without desert recolor"
  fi
}

paint_deserts_over_albedo() {
  local shp
  shp=$(find "$NE_DESERT_DIR" -type f -name "ne_10m_geography_regions_polys.shp" | head -n1 || true)
  if [ -z "$shp" ]; then
    shp=$(find "$NE_DESERT_DIR" -type f -name "*.shp" | head -n1 || true)
  fi
  [ -z "$shp" ] && { echo "Desert polygons not found; skipping desert paint"; return; }
  local DESERT_MASK="$DATA_DIR/desert_mask.tif"
  echo "🏜️  Rasterizing deserts mask from $(basename "$shp")"
  if ! gdal_rasterize -burn 255 -burn 255 -burn 255 -burn 255 \
    -where "featurecla='desert' OR class='desert' OR name LIKE '%Desert%' OR name_en LIKE '%Desert%'" \
    -ts "$SIZE_W" "$SIZE_H" -ot Byte -init 0 \
    -te -180 -90 180 90 -a_nodata 0 \
    "$shp" "$DESERT_MASK"; then
    echo "⚠️  Desert filter failed; painting all polys (fallback)"
    gdal_rasterize -burn 255 -burn 255 -burn 255 -burn 255 \
      -ts "$SIZE_W" "$SIZE_H" -ot Byte -init 0 \
      -te -180 -90 180 90 -a_nodata 0 \
      "$shp" "$DESERT_MASK"
  fi
  if cmd_exists magick; then
    echo "🎨 Painting deserts color $DESERT_HEX"
    magick convert "$OUT_DIR/earth_albedo.png" \
      \( "$DESERT_MASK" -alpha on -channel a -separate +channel \) \
      -compose over -fill "$DESERT_HEX" -colorize 100 -compose DstOver -composite \
      "$OUT_DIR/earth_albedo.png"
  elif cmd_exists convert; then
    convert "$OUT_DIR/earth_albedo.png" \
      \( "$DESERT_MASK" -alpha on -channel a -separate +channel \) \
      -compose over -fill "$DESERT_HEX" -colorize 100 -compose DstOver -composite \
      "$OUT_DIR/earth_albedo.png"
  else
    echo "ImageMagick not available; desert recolor skipped"
  fi
}

# Compute downscaled dimensions
rough_w() { awk -v w="$SIZE_W" -v s="$ROUGHNESS_SCALE" 'BEGIN{printf("%d", w*s)}'; }
rough_h() { awk -v h="$SIZE_H" -v s="$ROUGHNESS_SCALE" 'BEGIN{printf("%d", h*s)}'; }
bump_w() { awk -v w="$SIZE_W" -v s="$BUMP_SCALE" 'BEGIN{printf("%d", w*s)}'; }
bump_h() { awk -v h="$SIZE_H" -v s="$BUMP_SCALE" 'BEGIN{printf("%d", h*s)}'; }

process_clouds() {
  local SRC="$ROOT_DIR/public/textures/clouds.png"
  local OUT_WEBP="$OUT_DIR/clouds.webp"
  if [ -f "$SRC" ]; then
    echo "☁️  Preparing downscaled clouds"
    if command -v cwebp >/dev/null 2>&1; then
      # Resize keeping aspect ratio to max width CLOUDS_MAX
      # Use ImageMagick if available to resize before webp for better quality at small sizes
      if cmd_exists magick; then
        magick "$SRC" -resize ${CLOUDS_MAX}x\> "$DATA_DIR/clouds_tmp.png"
        cwebp -q 85 "$DATA_DIR/clouds_tmp.png" -o "$OUT_WEBP" >/dev/null 2>&1 || true
        rm -f "$DATA_DIR/clouds_tmp.png"
      else
        cwebp -q 85 -resize ${CLOUDS_MAX} 0 "$SRC" -o "$OUT_WEBP" >/dev/null 2>&1 || true
      fi
    elif cmd_exists magick; then
      magick "$SRC" -resize ${CLOUDS_MAX}x\> -quality 85 "$OUT_WEBP" || true
    fi
  fi
}

main() {
  require_tools
  mkdir -p "$DATA_DIR" "$OUT_DIR"

  prepare_etopo
  prepare_natural_earth

  if [ ! -f "$COLORS_FILE" ]; then
    echo "Color ramp not found at $COLORS_FILE" >&2
    exit 1
  fi

  local COLOR_TIF="$DATA_DIR/etopo_color.tif"
  echo "🎨 Colorizing with $COLORS_FILE"
  gdaldem color-relief "$ETOPO_TIF" "$COLORS_FILE" -alpha -of GTiff "$COLOR_TIF"

  echo "🖼️  Resampling to ${SIZE_W}x${SIZE_H}"
  gdal_translate -of PNG -outsize "$SIZE_W" "$SIZE_H" "$COLOR_TIF" "$OUT_DIR/earth_albedo.png"

  echo "🪵 Generating roughness (from slope)"
  gdaldem slope -s 111120 "$ETOPO_TIF" "$DATA_DIR/slope.tif"
  local RW RH; RW=$(rough_w); RH=$(rough_h)
  gdal_translate -scale 0 90 64 200 -of PNG -outsize "$RW" "$RH" "$DATA_DIR/slope.tif" "$OUT_DIR/earth_roughness.png"

  echo "🗺️  Generating bump"
  local BW BH; BW=$(bump_w); BH=$(bump_h)
  gdal_translate -scale -11000 8000 0 255 -ot Byte -of PNG -outsize "$BW" "$BH" "$ETOPO_TIF" "$OUT_DIR/earth_bump.png"
  if command -v cwebp >/dev/null 2>&1; then
    cwebp -q 85 "$OUT_DIR/earth_bump.png" -o "$OUT_DIR/earth_bump.webp" >/dev/null 2>&1 || true
  elif cmd_exists magick; then
    magick "$OUT_DIR/earth_bump.png" -quality 85 "$OUT_DIR/earth_bump.webp" || true
  fi

  paint_deserts_over_albedo || true
  process_clouds || true

  # Convert albedo to WebP (smaller)
  if command -v cwebp >/dev/null 2>&1; then
    echo "🔄 Converting albedo to WebP"
    cwebp -q 85 "$OUT_DIR/earth_albedo.png" -o "$OUT_DIR/earth_albedo.webp" >/dev/null 2>&1 || true
  elif cmd_exists magick; then
    magick "$OUT_DIR/earth_albedo.png" -quality 85 "$OUT_DIR/earth_albedo.webp" || true
  fi

  echo "✅ Done. Outputs:"
  echo "  - $OUT_DIR/earth_albedo.(png|webp)"
  echo "  - $OUT_DIR/earth_roughness.png (outsize ${RW}x${RH})"
  echo "  - $OUT_DIR/earth_bump.(png|webp) (outsize ${BW}x${BH})"
  echo "  - $OUT_DIR/clouds.webp (if source existed)"
}

main "$@" 