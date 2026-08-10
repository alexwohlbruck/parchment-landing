<script setup lang="ts">
/**
 * A night sky — stars on a celestial sphere, turning.
 *
 * Nothing renders this yet. It is here for a dark section further down the
 * page, and it is here *now* because the hero kept its paper: the globe sits
 * on the map, so the sky has nowhere to be at the top of the page and would
 * otherwise have to be ported a second time when that section is built.
 *
 * Ported from barrelman-landing, where it sits under the closing band. Pair it
 * with the `.starfield` haze in the stylesheet — that is the unresolvable
 * background glow, and these are the stars you can pick out of it:
 *
 *   <section class="relative overflow-hidden" style="background: var(--space)">
 *     <div class="starfield pointer-events-none absolute inset-0" />
 *     <StarField />
 *   </section>
 *
 * One driver is gone with the move. There, the band crossing the viewport
 * swung the sky as you scrolled to it; this page is a single snap section and
 * `window` never scrolls, so what is left is the pointer — which was doing the
 * visible work anyway. Put the scroll driver back from barrelman's copy if the
 * new section lands on a page that actually scrolls.
 *
 * Three things had to be true at once, and they pull against each other.
 *
 * **Sparkle** is stars going off at different times. A stack of
 * `radial-gradient`s, which this used to be, can only be animated as one
 * thing, so every star in it brightens on the same clock; at any amplitude
 * worth seeing that reads as the whole panel pulsing. So each star is an
 * element, with its own duration and a negative delay that drops it at a
 * random point in its cycle.
 *
 * **Drift** is the sky turning overhead. Sliding the field sideways is the
 * cheap version and looks it, because everything moves at one speed. Real
 * stars sit on a sphere: they accelerate through the meridian and slow toward
 * the horizon, and that foreshortening is the whole tell. So each star has a
 * longitude and a latitude, the longitude advances, and the projection does
 * the rest — `x = cos(lat)·sin(lon)` is fastest at `lon = 0` and stalls at the
 * limb for free.
 *
 * **Swing** is the same sphere answering the reader, eased toward rather than
 * tracked. It exists because the drift alone is deliberately too slow to watch
 * — an hour a turn — so all the work the sphere does was invisible unless you
 * left the page open and came back. A few degrees of longitude under the cursor
 * shows it in a second: stars near the meridian slide, stars near the limb
 * barely move, and the paths bend. That difference is the sphere, and it is
 * the thing worth being able to see.
 *
 * Sparkle is kept apart from the other two so neither has to know about it:
 * the outer element is position, written from the animation loop, and the
 * inner one is sparkle, left entirely to CSS. Both want the `transform`
 * property, and one would otherwise overwrite the other every frame.
 */

/** mulberry32 — small, fast, and identical on both sides of the render. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box–Muller, for the scatter either side of the galactic band. */
function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
}

/**
 * A full turn of the sky, in seconds. About an hour: at this width that is a
 * couple of pixels a second, which is under the rate at which motion registers
 * as motion. You should never catch a star drifting — you should only notice,
 * coming back, that the sky is not where you left it.
 */
const PERIOD_S = 3600

/**
 * How much of the sphere's width the frame shows. At 1 the limb sits exactly on
 * the left and right edges, so stars fade out precisely as they leave; wider
 * than that and they would wink out mid-air.
 */
const SPREAD_X = 1
/**
 * Latitude, squashed. Barrelman's band is a shallow strip and wanted 0.62; a
 * hero is a whole viewport, so the sky is nearer square and the scatter has to
 * reach the top of the frame rather than bunching across its middle.
 */
const SPREAD_Y = 0.92

/**
 * Tilt of the pole, radians. Without it every star travels dead horizontally
 * and the sphere collapses back into a sideways slide — the speed still
 * varies, but nothing curves, and curvature is what the eye actually reads as
 * rotation. In a frame this tall it can afford the globe's own 23.5°, which is
 * the tilt the planet under it is already spinning on; barrelman's shallow band
 * had to settle for ten degrees.
 */
const TILT = 0.41
const COS_TILT = Math.cos(TILT)
const SIN_TILT = Math.sin(TILT)

/**
 * A point on the sphere, projected into the band as percentages.
 *
 * Orthographic, which is right for something meant to be at infinity, and
 * means the only depth cue is `z` — used to fade stars out as they reach the
 * limb rather than to scale them.
 *
 * The tilt arrives as its sine and cosine rather than as an angle because it
 * is no longer constant — the pointer nods it — and this runs a couple of
 * hundred times a frame.
 */
function project(
  star: { lon: number; cosLat: number; sinLat: number },
  turn: number,
  cosTilt: number,
  sinTilt: number,
) {
  const lon = star.lon + turn
  const x = star.cosLat * Math.sin(lon)
  const y = star.sinLat
  return {
    x: (x * cosTilt - y * sinTilt) * 50 * SPREAD_X,
    y: (x * sinTilt + y * cosTilt) * 50 * SPREAD_Y,
    z: star.cosLat * Math.cos(lon),
  }
}

interface Star {
  /** Longitude at t=0, radians. Advances with the turn. */
  lon: number
  cosLat: number
  sinLat: number
  size: string
  color: string
  opacity: number
  duration: string
  delay: string
  glow: string
  sparkle: boolean
  /** Projected position at t=0, so the server can place it. */
  left: string
  top: string
  /**
   * The limb fade at t=0, likewise.
   *
   * Only the loop used to apply this, which left the quarter of the field that
   * starts behind the sphere drawn at full strength and stacked along the two
   * edges — for the whole of the first paint, for anyone with reduced motion,
   * where the loop never runs at all, and for anyone with no JS.
   */
  edge: string
}

// ── What a star looks like ──────────────────────────────────────────────

/**
 * Apparent magnitude, over the range the naked eye works in: about 1 for the
 * few that name constellations, about 6.3 for the faintest anyone can pick out
 * on a dark night at sea.
 */
const MAG_BRIGHT = 1.2
const MAG_FAINT = 6.2

/**
 * How steeply the sky fills up as it gets fainter.
 *
 * Real counts go as `10^0.6m` — roughly four times as many stars in each
 * magnitude as in the one above it, which is why the sky has some twenty
 * thousand stars to sixth magnitude and about fifteen to first.
 *
 * A field of a couple of hundred cannot have that ratio and still have a
 * bright end: sampled at the real slope every last star lands within a
 * magnitude of the limit, which is not only dim but *uniform* — same flux, so
 * same size and same opacity, and the sky comes out as evenly spaced identical
 * dust. Under half the real slope the shape is still the true one, many faint
 * against a handful bright with the count rising smoothly between, but spread
 * over enough of the range that the sky has a hierarchy to read.
 */
const MAG_SLOPE = 0.26

/** Inverse of the cumulative count, so a uniform draw lands on that curve. */
function magnitudeAt(u: number, bright = MAG_BRIGHT, faint = MAG_FAINT) {
  const a = 10 ** (MAG_SLOPE * bright)
  const b = 10 ** (MAG_SLOPE * faint)
  return Math.log10(a + u * (b - a)) / MAG_SLOPE
}

/**
 * Spectral classes and the colours they actually show, with roughly the mix a
 * naked-eye sky has — heavy on white and yellow-white, a fifth of it warm.
 *
 * Stars are not white dots. They are not saturated either: the tint is there
 * in the bright ones (Rigel is blue, Betelgeuse and Antares are orange) and
 * gone in the faint ones, because colour vision fails before brightness does.
 * So saturation rides on flux below, and the faintest stars come out the
 * paper white the rest of the page is drawn in.
 */
const CLASSES = [
  { share: 0.06, rgb: [155, 176, 255] }, // B — blue
  { share: 0.14, rgb: [202, 216, 255] }, // A — blue-white
  { share: 0.26, rgb: [248, 247, 255] }, // F — white
  { share: 0.3, rgb: [255, 244, 234] }, // G — yellow-white
  { share: 0.16, rgb: [255, 210, 161] }, // K — orange
  { share: 0.08, rgb: [255, 180, 130] }, // M — red
]

/** `--paper`. What a star with no colour left in it should be. */
const PAPER = [255, 249, 243]

function classFor(u: number) {
  let acc = 0
  for (const c of CLASSES) {
    acc += c.share
    if (u <= acc) return c.rgb
  }
  return CLASSES[CLASSES.length - 1]!.rgb
}

// ── Where the stars are ─────────────────────────────────────────────────

const COUNT = 145

/**
 * Stars in the galactic band, on top of the evenly scattered ones.
 *
 * The Milky Way is the one feature that makes a sky read as *the* sky rather
 * than as scattered dots, and it is not a painted streak — it is the disc of
 * the galaxy seen edge-on, which is to say a great many stars too faint to
 * separate, crowded along one great circle. So it is built the way it looks:
 * more stars, all of them at the faint limit, gathered about a circle set at
 * an angle to the sky's own axis.
 */
const BAND_COUNT = 55
/** Inclination of that circle to the sphere's equator, radians. */
const BAND_TILT = 0.62
/** Scatter either side of it, radians. Roughly the width of the real thing. */
const BAND_SPREAD = 0.13
const TAN_BAND = Math.tan(BAND_TILT)

/**
 * Where the band crosses the equator.
 *
 * A quarter turn, which is what puts the crossing in the middle of the window
 * the panel shows and runs the band corner to corner. Left at zero the circle
 * is symmetric about the centre of the view, so it comes out as a shallow arc
 * dipping behind the planet — the right shape for a great circle seen down its
 * own node, and the wrong one for a sky, where the Milky Way is the thing that
 * cuts across everything else.
 */
const BAND_NODE = Math.PI / 2

/**
 * Latitude of the galactic band at a given longitude.
 *
 * The band is the great circle perpendicular to a pole tilted off the sphere's
 * own, so its points are the ones with `p·n = 0`; solving that for latitude is
 * this. Doing it this way rather than walking the circle keeps every band star
 * inside the longitudes the panel can actually show.
 */
function bandLatAt(lon: number) {
  return Math.atan(-Math.cos(lon - BAND_NODE) * TAN_BAND)
}

/**
 * Evaluated once at module scope, from a fixed seed, so the server and the
 * client generate the same sky and the markup hydrates without a mismatch.
 * `Math.random()` here would repaint every star on hydration.
 */
const stars: Star[] = (() => {
  const rand = rng(20260805)
  const out: Star[] = []

  const add = (lon: number, lat: number, mag: number, dim: number) => {
    // Flux, from the magnitude that produced it. Pogson's ratio: five
    // magnitudes is a factor of a hundred, and everything below hangs off it.
    const flux = 10 ** (-0.4 * (mag - MAG_BRIGHT))

    // Colour vision goes before brightness does, so the tint fades with the
    // star rather than being applied flat across the field.
    const sat = Math.min(1, flux ** 0.28)
    const rgb = classFor(rand())
    const color = rgb.map((c, i) => Math.round(PAPER[i]! + (c! - PAPER[i]!) * sat))

    // Size is not the star, which is a point — it is what the eye and the air
    // make of one, and that grows with flux far more slowly than flux does.
    // Slowly, though, not barely: a heavier compression than this put four
    // fifths of the field inside a fifth of a pixel of each other.
    const size = 0.8 + 2.7 * flux ** 0.42
    const glow = flux >= 0.05 ? 1.6 + 5.5 * flux : 0

    out.push({
      lon,
      cosLat: Math.cos(lat),
      sinLat: Math.sin(lat),
      size: `${size.toFixed(2)}px`,
      color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      // A floor under the faint end, then the curve on top of it. Flux alone
      // spans a hundred to one and the eye does not: sixth magnitude is a real
      // star you can really see, and mapping it to two percent opacity — which
      // the twinkle then takes a further quarter off — empties the sky of the
      // hundred-odd stars that are supposed to be its ground.
      opacity: +Math.min(1, (0.18 + 0.82 * flux ** 0.42) * dim).toFixed(3),
      // Durations spread wide and delays pulled backwards over a longer
      // span, so no two stars share a phase and the field never
      // resynchronises into a visible beat.
      duration: `${(2.4 + rand() * 5.5).toFixed(2)}s`,
      delay: `${(rand() * -9).toFixed(2)}s`,
      glow: glow
        ? `0 0 ${glow.toFixed(1)}px ${(glow / 2).toFixed(1)}px rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.35)`
        : 'none',
      // Only the brightest few. Every star twinkling is noise; a handful doing
      // it against a still field is what the eye reads as a night sky.
      sparkle: flux > 0.16,
      // Filled in below, from the same projection the loop uses. Computing
      // it by hand here would be a second copy of the maths, and the two
      // would disagree on the first frame — as a visible jolt of the entire
      // sky the moment the page hydrates.
      left: '',
      top: '',
      edge: '1',
    })
  }

  // Longitude over the near hemisphere plus a margin either side, so there is
  // always a supply of stars about to rotate into view rather than a visibly
  // empty edge.
  const someLon = () => (rand() * 2 - 1) * (Math.PI / 2 + 0.5)

  for (let i = 0; i < COUNT; i++) {
    // `asin` of a uniform value, not a uniform angle: uniform latitude bunches
    // stars toward the poles, which here means a visible seam of them along
    // the top and bottom edges.
    add(someLon(), Math.asin(rand() * 2 - 1) * 0.85, magnitudeAt(rand()), 1)
  }

  for (let i = 0; i < BAND_COUNT; i++) {
    const lon = someLon()
    const lat = bandLatAt(lon) + gauss(rand) * BAND_SPREAD
    // Drawn from the faint end only, and dimmed again on top of that. The band
    // has to sit behind the resolved stars — the moment any of it competes,
    // it stops reading as unresolved distance and starts reading as clutter.
    add(lon, Math.max(-1.3, Math.min(1.3, lat)), magnitudeAt(rand(), 5.2, 6.6), 0.7)
  }

  for (const star of out) {
    const p = project(star, 0, COS_TILT, SIN_TILT)
    star.left = `${(50 + p.x).toFixed(3)}%`
    star.top = `${(50 + p.y).toFixed(3)}%`
    star.edge = p.z <= 0 ? '0' : Math.min(1, p.z / 0.3).toFixed(3)
  }
  return out
})()

// ── The turn ────────────────────────────────────────────────────────────

const root = ref<HTMLElement | null>(null)
/**
 * Collected by `:ref`, and written to directly rather than through reactive
 * style bindings. Vue would re-render every star component on every frame to
 * move them;
 * a bare `style.transform` write does not touch the framework at all.
 */
const nodes: HTMLElement[] = []
const setNode = (el: unknown, i: number) => {
  if (el) nodes[i] = el as HTMLElement
}

let frameId: number | null = null
let observer: IntersectionObserver | null = null
let sizeObserver: ResizeObserver | null = null
let width = 0
let height = 0
let startedAt = 0

/**
 * Pixel offsets the server already placed each star at. The loop writes
 * *deltas* from these, so the transform is zero on the first frame and nothing
 * jumps when the static markup hydrates.
 */
const baseX: number[] = []
const baseY: number[] = []

/**
 * How far the sky swings under the cursor: degrees of longitude at the
 * meridian, and degrees of nod on the pole.
 *
 * Three, against the rhumb network's six, and for the same reason in reverse.
 * Six degrees of a chart turns hairlines a few pixels; six degrees of longitude
 * carries a star at the meridian across a twentieth of the band, which is not a
 * sky answering the cursor but a sky being dragged. Three reads as weight.
 *
 * The nod is the second axis. Longitude alone moves everything along one family
 * of curves, and a small tilt of the pole crossed with it is what keeps the
 * motion from resolving into a single direction.
 */
const SWING_DEG = 3
const NOD_DEG = 1.2

/** Cursor position as -1..1 from the centre of the viewport. */
let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0

/** Slow enough that the sky lags the cursor. The lag is what gives it mass. */
const EASE = 0.045

function measure() {
  if (!root.value) return
  width = root.value.clientWidth
  height = root.value.clientHeight
}

function cacheBase() {
  for (let i = 0; i < stars.length; i++) {
    const p = project(stars[i]!, 0, COS_TILT, SIN_TILT)
    baseX[i] = (p.x * width) / 100
    baseY[i] = (p.y * height) / 100
  }
}

/**
 * The sky turns once an hour, which is about a pixel a second at this width.
 * Recomputing two hundred positions sixty times a second to move each of them a
 * sixtieth of a pixel is work nobody can see; at 10fps the step is a tenth of
 * a pixel, still under what a screen can show, for a sixth of the cost.
 *
 * The swing is the exception and takes the full rate — it is fast enough to
 * step visibly at ten — so the loop runs flat out while the easing is live and
 * drops back to the idle rate the moment it settles. Which is nearly always:
 * the drift is the steady state and the swing is what happens when someone
 * moves.
 */
const IDLE_FPS = 10
let lastMoveAt = 0

function tick(now: number) {
  if (!startedAt) startedAt = now
  frameId = requestAnimationFrame(tick)

  // Ease toward the cursor rather than tracking it. Following exactly makes
  // the sky feel stuck to the pointer; the lag is what makes it feel distant.
  currentX += (targetX - currentX) * EASE
  currentY += (targetY - currentY) * EASE

  const swinging =
    Math.abs(targetX - currentX) > 0.0015 || Math.abs(targetY - currentY) > 0.0015

  if (!swinging && now - lastMoveAt < 1000 / IDLE_FPS) return
  lastMoveAt = now

  const swing = (currentX * 0.8 + currentY * 0.2) * SWING_DEG
  const drift = ((now - startedAt) / 1000 / PERIOD_S) * Math.PI * 2
  const turn = drift + (swing * Math.PI) / 180
  const tilt = TILT + (currentY * NOD_DEG * Math.PI) / 180
  const cosTilt = Math.cos(tilt)
  const sinTilt = Math.sin(tilt)

  for (let i = 0; i < stars.length; i++) {
    const node = nodes[i]
    if (!node) continue

    const p = project(stars[i]!, turn, cosTilt, sinTilt)

    // Behind the sphere. Hiding rather than letting it run off-screen keeps a
    // star from sliding back across the band the wrong way as longitude wraps.
    if (p.z <= 0) {
      node.style.opacity = '0'
      continue
    }

    const dx = (p.x * width) / 100 - baseX[i]!
    const dy = (p.y * height) / 100 - baseY[i]!
    node.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`
    // Fade through the limb rather than cutting out at it.
    node.style.opacity = Math.min(1, p.z / 0.3).toFixed(3)
  }
}

function start() {
  if (frameId === null) frameId = requestAnimationFrame(tick)
}
function stop() {
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
}

function onPointerMove(event: PointerEvent) {
  // Read only. Everything else happens on the next frame — a pointermove
  // handler fires far more often than the display refreshes, and anything it
  // writes is written several times per painted frame.
  targetX = (event.clientX / window.innerWidth) * 2 - 1
  targetY = (event.clientY / window.innerHeight) * 2 - 1
}

onMounted(() => {
  measure()
  cacheBase()

  // A sky that drifts is decoration, and decoration is the first thing to drop
  // for a reader who asked for less motion. The field stays; it holds still.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // On a hero this earns its keep on the tab rather than on the scroll: in a
  // background tab it is two hundred elements being moved for nobody.
  observer = new IntersectionObserver(([entry]) => {
    const onScreen = entry?.isIntersecting ?? false
    onScreen ? start() : stop()
    // Stop the CSS animations too, not just the position loop. A running
    // opacity animation keeps its element promoted, so the whole field off
    // screen is two hundred compositor layers held open for the page.
    root.value?.classList.toggle('paused', !onScreen)
  })
  if (root.value) observer.observe(root.value)

  sizeObserver = new ResizeObserver(() => {
    measure()
    cacheBase()
  })
  if (root.value) sizeObserver.observe(root.value)

  window.addEventListener('pointermove', onPointerMove, { passive: true })
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  sizeObserver?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
})
</script>

<template>
  <div ref="root" class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <span
      v-for="(star, i) in stars"
      :key="i"
      :ref="(el) => setNode(el, i)"
      class="absolute"
      :style="{ left: star.left, top: star.top, opacity: star.edge }"
    >
      <span
        class="star block rounded-full"
        :class="star.sparkle ? 'star-bright' : ''"
        :style="{
          width: star.size,
          height: star.size,
          background: star.color,
          boxShadow: star.glow,
          '--star-opacity': star.opacity,
          '--star-duration': star.duration,
          '--star-delay': star.delay,
        }"
      />
    </span>
  </div>
</template>

<style scoped>
/**
 * Opacity and transform only — both composited, so two hundred stars
 * animating at once cost the main thread nothing. Animating width, height or
 * box-shadow instead would lay out and repaint the section every frame — the
 * section being the whole first screen, with a WebGL globe already on it.
 */
/*
 * No `will-change`. It was here on the reasoning that an animated property
 * should be promoted, but this selector matches every star, and promoting them
 * all means that many permanent compositor layers to allocate, track and blend
 * — for dots two pixels across. Browsers already promote an element for the
 * duration of an opacity animation; the hint only makes it permanent.
 */
.star {
  opacity: var(--star-opacity);
  animation: twinkle var(--star-duration) ease-in-out var(--star-delay) infinite;
}

/* The bright few also breathe in size, which is what separates a sparkle from
   a fade. Kept under 1.4x: past that they read as pulsing dots. */
.star-bright {
  animation-name: sparkle;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: calc(var(--star-opacity) * 0.25);
  }
  50% {
    opacity: var(--star-opacity);
  }
}

@keyframes sparkle {
  0%,
  100% {
    opacity: calc(var(--star-opacity) * 0.3);
    transform: scale(0.7);
  }
  50% {
    opacity: var(--star-opacity);
    transform: scale(1.35);
  }
}

/* Off screen: hold every star still so none of them stay promoted. */
.paused .star {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .star {
    animation: none;
  }
}
</style>
