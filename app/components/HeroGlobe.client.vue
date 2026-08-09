<script setup lang="ts">
/**
 * The hero globe.
 *
 * The lighting here came back from barrelman-landing, where this component was
 * ported to sit under the closing band and then rewritten. What it replaces:
 * the surface was shaded by a fresnel against the view axis, which lights every
 * globe identically from wherever the camera happens to be, and the atmosphere
 * was an even band keyed to the shell's own silhouette. Both are gone. There is
 * a directional sun now, and scattering measured along the view ray, which is
 * what gives this one a lit side, a horizon that thins with altitude, and
 * sunset colour in the air where the light runs out.
 *
 * `.client` because three touches `window` at import time, and because ~600KB
 * of renderer has no business in the payload of a page whose first screen is
 * text. The fade on `ready` covers the gap: an un-textured sphere popping in is
 * worse than a beat of nothing.
 */
import * as THREE from "three";

const emit = defineEmits<{ (e: "ready"): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let sphere: THREE.Mesh;
let tiltGroup: THREE.Group | null = null;
let earthMat: THREE.ShaderMaterial;
let clouds: THREE.Mesh | null = null;
let atmosphere: THREE.Mesh | null = null;

/**
 * Where the sun is, in view space.
 *
 * View space rather than world space because the camera never moves, which
 * makes the two the same basis and saves transforming the vector every frame —
 * and because everything the shaders compare it against (`normalMatrix * normal`,
 * the fragment's own position) already lives there.
 *
 * Up and to the left, two thirds of the way toward the viewer. Across the cap
 * of planet this hero actually shows, that runs the surface from full daylight
 * at the left of the arc down to the last of it at the right, and puts the
 * terminator itself just off the end — so the evening in this frame is carried
 * by the colour of the air beyond the limb rather than by a shadow lying on the
 * ocean. Which is the right trade for a hero: the light has an unmistakable
 * direction and the headline still sits over a lit world.
 *
 * The lit pole is the north one, the side the 23.5° tilt leans toward us.
 */
const SUN = new THREE.Vector3(-0.66, 0.36, 0.66).normalize();

/**
 * Sunlight, slightly above white, and the colour it decays to at grazing
 * incidence — the same reddening that makes sunsets, from the same cause: at
 * the terminator the light has crossed far more air, and the air has scattered
 * the short wavelengths out of it.
 */
const SUN_COLOR = new THREE.Color(1.12, 1.08, 1.02);
const DUSK_COLOR = new THREE.Color(1.0, 0.72, 0.45);

/**
 * Rayleigh blue. One colour serves both the haze the surface picks up near the
 * limb and the shell of air outside it, because it is one phenomenon: sunlight
 * scattered by air, seen either against the ground or against space.
 */
const SKY_COLOR = new THREE.Color(0.38, 0.58, 1.0);

/** Radii. The surface, and how far out the air is still worth drawing. */
const EARTH_R = 1.06;
const ATMO_R = 1.23;

/**
 * How far back the camera sits. Named because the shading depends on it: how
 * edge-on the surface is at the horizon is a function of the viewing distance,
 * not of the sphere alone.
 */
const CAM_Z = 3.1;

/**
 * Vertical field of view.
 *
 * Not a framing choice — the atmosphere sets it. A sphere seen from a finite
 * distance presents a silhouette at `asin(r / z)`, and for the shell that is
 * 23.4°, against the 22.5° half-angle a 45° lens gives. So the air overflowed
 * the frame by 2.2% of its height, top and bottom, and the density in the
 * shader only falls to zero at the shell's own edge — which was outside the
 * canvas. What the top edge cut was a live value, around 8% of full glow.
 *
 * On this page that cut lands at the top edge of the globe's box, which sits
 * at mid-viewport over the map: a horizontal rule across the paper, the full
 * width of the hero.
 *
 * 48.5° puts the shell's silhouette at 96% of the frame height, so the glow
 * runs out on its own before the frame does. That makes the planet smaller
 * within the canvas, which <index> takes back by making the canvas
 * proportionally larger: same globe on screen, with room around it.
 *
 * On this branch the halved scale height below already takes the density to
 * nothing long before the shell, so the cut could not happen at 45° either.
 * The lens stays where it is anyway: it is the framing the other branch uses,
 * and the two should not be a different size on screen for a reason that is
 * really about a shader constant.
 */
const FOV = 48.5;

/**
 * How edge-on the surface is at the horizon, as `1 - N·V`.
 *
 * Not 1: from a finite distance the visible cap stops short of the geometric
 * equator, at `N·V = r/d`. Taking the limb to be 1 — which is what an
 * unnormalised fresnel assumes — puts the peak of any limb term somewhere
 * beyond the edge of the planet and leaves a third of the disc sitting under
 * the shoulder of the curve. That is what made the aerial perspective read as
 * a pale wedge of fog lying across the ocean rather than as a horizon.
 */
const HORIZON_EDGE = 1.0 - EARTH_R / CAM_Z;

/**
 * Grain, shared by the surface and the clouds so the two agree.
 *
 * Inherited from the original, where it roughened the silhouette; it now
 * roughens the terminator, which is both the more useful place for it — a
 * machined day/night gradient is the giveaway that a globe is a shader — and
 * the more honest one, since the real edge is broken by terrain and weather.
 */
const GRAIN = `
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
`;

/**
 * The colour of sunlight at a given incidence.
 *
 * Shared by the ground and the weather on top of it, because it is the same
 * sunlight and they have to agree about it. When they did not — the clouds
 * ramping to dusk anywhere below a fairly high sun, the surface only in a
 * narrow band around the terminator — the weather turned sandy over an ocean
 * still in plain daylight, which reads as a stained texture rather than as
 * evening.
 *
 * Two smoothsteps rather than one: the reddening has to arrive as the sun gets
 * low and then leave again as the ground goes dark, so what it describes is a
 * band around the terminator, not everything on one side of it.
 */
const SUNLIGHT = `
  vec3 sunlightAt(float ndl, vec3 sunColor, vec3 duskColor){
    float dusk = smoothstep(0.28, -0.02, ndl) * smoothstep(-0.2, 0.02, ndl);
    return mix(sunColor, duskColor, dusk * 0.75);
  }
`;

/** Idle spin, in radians per second. Slow: it is scenery, not a loading state. */
const SPIN = 0.05;

/**
 * How much faster than the ground the weather runs, as a fraction of the spin.
 * A tenth, which is the 1.1x the cloud layer has always had, expressed the way
 * a child of the surface has to express it: as the difference alone.
 */
const CLOUD_LEAD = 0.1;

let frameId: number | null = null;
let lastFrameAt = 0;
let sizeObserver: ResizeObserver | null = null;
let viewObserver: IntersectionObserver | null = null;
let resizeScheduled = false;

function play() {
  if (frameId === null) {
    lastFrameAt = 0;
    frameId = requestAnimationFrame(animate);
  }
}

function pause() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
}

/**
 * Everything that has to be undone. The original attached mouse and touch
 * handlers to `window` and never removed them, which is invisible on a page
 * that only unmounts on navigation and a leak everywhere else.
 */
const teardown: Array<() => void> = [];
function on<K extends keyof WindowEventMap>(
  target: Window | HTMLElement,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions
) {
  target.addEventListener(type, handler as EventListener, options);
  teardown.push(() =>
    target.removeEventListener(type, handler as EventListener, options)
  );
}

let albedoLoaded = false;
let firstFrameRendered = false;
let readyEmitted = false;
function maybeEmitReady() {
  if (readyEmitted || !albedoLoaded || !firstFrameRendered) return;
  readyEmitted = true;
  emit("ready");
}

let isDragging = false;
let lastX = 0;
let lastY = 0;
let rotVelY = 0;

function init() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || canvas.clientWidth || window.innerWidth;
  const height =
    parent?.clientHeight ||
    canvas.clientHeight ||
    Math.round(window.innerHeight * 0.6);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // Earth's axial tilt, so the spin axis is not dead vertical.
  tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
  scene.add(tiltGroup);

  earthMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      sunDir: { value: SUN },
      sunColor: { value: SUN_COLOR },
      duskColor: { value: DUSK_COLOR },
      skyColor: { value: SKY_COLOR },
      /**
       * What the night side is lit by.
       *
       * Over barrelman's night band this is earthshine and starlight, and it is
       * nearly nothing — correctly, because the sky it sits in is nearly
       * nothing too. On paper there is no such agreement: a night side at 4% of
       * albedo against a page at 97% is a hole cut in the sheet, and it is the
       * heaviest thing in the hero by a distance.
       *
       * Lifted, and lifted warm, so the unlit side reads as the shaded part of
       * a drawn globe rather than as an absence. It is no longer earthshine —
       * it is the ambient a printed illustration gets from the paper around it,
       * which is the honest description of what this hero is.
       */
      nightColor: { value: new THREE.Color(0.2, 0.185, 0.165) },
      grainScale: { value: 900.0 },
      grainAmount: { value: 0.022 },
      horizonEdge: { value: HORIZON_EDGE },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform vec3 duskColor;
      uniform vec3 skyColor;
      uniform vec3 nightColor;
      uniform float grainScale;
      uniform float grainAmount;
      uniform float horizonEdge;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      ${GRAIN}
      ${SUNLIGHT}

      // Linear until the knee, then rolls off to 1.0. The lit limb runs well
      // past white once the haze is added on top of it, and clipping that flat
      // is what makes a rim read as a sticker rather than as light.
      vec3 knee(vec3 c, float k) {
        vec3 over = max(c - k, 0.0);
        return min(c, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vViewPos);
        vec3 L = normalize(sunDir);
        vec3 albedo = texture2D(map, vUv).rgb;

        float ndl = dot(N, L);

        // Break the day/night edge with the page's own grain, windowed to the
        // terminator so only the diffuse term sees it. Jittering the sun angle
        // itself feeds the same noise into the dusk band, whose transition is
        // narrow enough that a jitter of a few hundredths comes out as static.
        float grain = (hash21(vUv * grainScale) - 0.5) * 2.0;
        float toothed = ndl + grain * grainAmount * smoothstep(0.35, 0.0, abs(ndl));

        // Wrapped diffuse. Air scatters sunlight past the geometric terminator,
        // so the real falloff is wider than Lambert and never reaches a hard
        // edge; the wrap is the cheap stand-in for that.
        //
        // Wider and flatter than the night-band version, which kept dusk to a
        // strip because a pale sash across a dark ocean is the failure mode
        // there. On paper the failure mode is the opposite one: a narrow
        // terminator against a light page is a hard edge between a lit globe
        // and a dark shape, and the eye reads the two as different objects.
        // A long ramp is what makes it one sphere turning away from a light.
        float wrap = 0.30;
        float day = pow(clamp((toothed + wrap) / (1.0 + wrap), 0.0, 1.0), 1.0);

        // Grazing light has crossed more atmosphere and comes out red.
        vec3 light = sunlightAt(ndl, sunColor, duskColor);

        vec3 col = albedo * light * day + albedo * nightColor;

        // Aerial perspective. Toward the limb the line of sight crosses far
        // more air, which both scatters blue into the ray and takes light out
        // of what is behind it. Weighted by illumination, because unlit air
        // scatters nothing — which is what keeps the haze off the night side,
        // where the old shader painted it brightest.
        //
        // Kept blue, and gone well before the terminator. Tinting it warm to
        // match the light there put a bright tan sash across the limb, which is
        // backwards: sky glow is at its strongest under a high sun and its
        // faintest at dusk, so what the surface does approaching night is go
        // dim and warm, from the light on the albedo, not bright and sandy.
        // The lit band outside the limb is the shell's job.
        float airmass = pow(clamp((1.0 - max(dot(N, V), 0.0)) / horizonEdge, 0.0, 1.0), 5.0);
        float airLit = smoothstep(0.04, 0.5, ndl);
        col *= mix(1.0, 0.78, airmass);
        col += skyColor * sunColor * airmass * airLit * 0.38;

        gl_FragColor = vec4(knee(col, 0.72), 1.0);
      }
    `,
  });

  sphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 192, 192), earthMat);
  sphere.rotation.y = -0.55;
  tiltGroup.add(sphere);

  /**
   * The air outside the planet, back-faced and additive so it reads as depth
   * rather than as a shell.
   *
   * The shell is only a surface to run the shader on; nothing about how it
   * looks comes from its geometry. Each fragment measures how close its own
   * view ray passes to the centre and shades from that, which is what makes
   * the rim thin, exponential and correctly anchored to the horizon — the
   * previous version keyed off the shell's own silhouette, which is why the
   * glow was an even band the full way round at whatever radius the sphere
   * happened to be, and why it read as a halo pasted behind the disc.
   */
  atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(ATMO_R, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: SUN },
        /**
         * Sky blue, walked toward cyan for this ground.
         *
         * The surface keeps SKY_COLOR — it is multiplied into an albedo that is
         * mostly ocean, and reads as haze. The shell adds it to bare paper,
         * where 0.38/0.58/1.0 is a blue with more red under it than the page
         * has, and the rim came out lavender: a colour neither the palette nor
         * the sky contains. Pulling the blue down and the green up lands it on
         * the same hue the ocean underneath is already using.
         */
        dayColor: { value: new THREE.Color(0.4, 0.64, 0.92) },
        /**
         * Dusk, pulled back from the vermilion the night band uses.
         *
         * Additive blending only ever brightens, so over --space an orange at
         * full chroma lands on black and reads as sunset. Over warm paper the
         * page is already most of the way to that hue, and the same orange adds
         * to it rather than replacing it — the limb came out as a pink-tan
         * smear sitting on the map, which is the one colour on the page that
         * looks like a printing fault.
         */
        duskColor: { value: new THREE.Color(0.92, 0.6, 0.42) },
        earthRadius: { value: EARTH_R },
        shellRadius: { value: ATMO_R },
        /**
         * How fast the air thins with altitude. Earth's real scale height is
         * 8.5km against a 6371km radius — 0.0013 here, which at this size is
         * a hairline nobody would see. Exaggerated to something drawable, but
         * still exponential, which is the part that matters: the rim is bright
         * and tight at the horizon and gone well before the shell's own edge.
         *
         * Half the night band's, because "gone" means something different on
         * paper. Against black, air at 5% of full glow is invisible and the
         * generous falloff is free. Against a sheet at 97% white it is a haze
         * lying over the map for a fifth of the viewport, and the map is the
         * thing it is lying over.
         */
        scaleHeight: { value: 0.032 },
        /**
         * And dimmer. Additive over paper has almost no headroom before it
         * clips to white: at 1.45 the rim was not air, it was a neon line
         * traced round the limb.
         */
        intensity: { value: 0.62 },
      },
      vertexShader: `
        varying vec3 vViewPos;
        varying vec3 vCenter;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = mv.xyz;
          // Constant across every vertex, so it survives interpolation intact.
          vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDir;
        uniform vec3 dayColor;
        uniform vec3 duskColor;
        uniform float earthRadius;
        uniform float shellRadius;
        uniform float scaleHeight;
        uniform float intensity;
        varying vec3 vViewPos;
        varying vec3 vCenter;

        void main() {
          // The camera sits at the origin in view space, so the fragment's own
          // position is the ray.
          vec3 D = normalize(vViewPos);

          // How close that ray passes to the planet's centre, and the outward
          // direction at the point of closest approach — the patch of sky this
          // pixel is actually looking through.
          vec3 offset = D * dot(vCenter, D) - vCenter;
          float d = length(offset);
          vec3 N = offset / max(d, 1e-5);

          // Column density along the ray, falling off exponentially with the
          // altitude at which it grazes. Rebased so it reaches exactly zero at
          // the shell, because a non-zero value there would draw the shell's
          // silhouette as a hard disc.
          float floorAt = exp(-(shellRadius - earthRadius) / scaleHeight);
          float density = (exp(-max(d - earthRadius, 0.0) / scaleHeight) - floorAt)
                        / (1.0 - floorAt);

          // Only lit air scatters, and it reddens as the sun grazes it, so the
          // rim is blue where the sun is high, orange along the terminator and
          // absent over the night side.
          float ndl = dot(N, normalize(sunDir));
          float lit = smoothstep(-0.32, 0.16, ndl);
          float dusk = smoothstep(0.5, -0.1, ndl);
          vec3 col = mix(dayColor, duskColor, dusk * dusk);

          float g = density * lit * intensity;
          // Premultiplied: the colour is already scaled by its own coverage, and
          // the alpha it contributes is that same coverage.
          gl_FragColor = vec4(col * g, g);
        }
      `,
      side: THREE.BackSide,
      /**
       * Plain one/one rather than `AdditiveBlending`, which is one/one for
       * colour but multiplies by the source alpha — and applies the same pair
       * to the alpha channel, so an opaque fragment drove the canvas alpha to 1
       * across the whole shell and stamped a disc over whatever the canvas is
       * composited onto. This one sits over the map photograph, so what the
       * shell writes into alpha matters as much as what it writes into RGB.
       */
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      transparent: true,
      depthWrite: false,
    })
  );
  atmosphere.renderOrder = 1;
  tiltGroup.add(atmosphere);

  const loader = new THREE.TextureLoader();

  loader.load("/textures/earth_albedo.webp", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    earthMat.uniforms.map!.value = tex;
    earthMat.needsUpdate = true;
    albedoLoaded = true;
    maybeEmitReady();
  });

  loader.load("/textures/clouds.webp", (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = false;
    /**
     * The clouds answer to the same sun as the ground under them.
     *
     * A `MeshBasicMaterial` cannot: it paints the texture at full white
     * wherever the alpha map says cloud, so weather over the night side glowed
     * as brightly as weather at noon, and the terminator ran underneath an
     * unbroken white sheet. Same alpha map, lit.
     */
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.062, 160, 160),
      new THREE.ShaderMaterial({
        uniforms: {
          alphaMap: { value: tex },
          sunDir: { value: SUN },
          sunColor: { value: SUN_COLOR },
          duskColor: { value: DUSK_COLOR },
          skyColor: { value: SKY_COLOR },
          horizonEdge: { value: HORIZON_EDGE },
          opacity: { value: 0.98 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPos;
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform sampler2D alphaMap;
          uniform vec3 sunDir;
          uniform vec3 sunColor;
          uniform vec3 duskColor;
          uniform vec3 skyColor;
          uniform float horizonEdge;
          uniform float opacity;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPos;

          ${SUNLIGHT}

          void main() {
            // Same channel three's own alphaMap reads, so the texture behaves
            // exactly as it did before.
            float a = texture2D(alphaMap, vUv).g * opacity;
            if (a < 0.004) discard;

            vec3 N = normalize(vNormal);
            vec3 V = normalize(-vViewPos);
            float ndl = dot(N, normalize(sunDir));

            // Cloud tops are deep and scatter light through themselves, so they
            // wrap a little further past the terminator than the ground does
            // and hold a sunset colour slightly longer — but only a little, or
            // the weather stays lit over a surface that has gone dark.
            float day = pow(clamp((ndl + 0.16) / 1.16, 0.0, 1.0), 1.2);
            vec3 light = sunlightAt(ndl, sunColor, duskColor);

            // Blue up from below, and brighter side-on at the limb, where a
            // cloud presents its flank rather than its top. Scaled by daylight
            // so it cannot pick out the unlit limb.
            float edge = clamp((1.0 - max(dot(N, V), 0.0)) / horizonEdge, 0.0, 1.0);
            float flank = 1.0 + 0.35 * pow(edge, 4.0) * day;
            vec3 col = light * day * flank + skyColor * 0.06 * day;

            gl_FragColor = vec4(col, a * (0.32 + 0.68 * day));
          }
        `,
        transparent: true,
        depthWrite: false,
      })
    );
    /**
     * Parented to the surface, not to the tilt group beside it.
     *
     * As a sibling the weather had to be turned by hand everywhere the ground
     * was, and one of those places was missed: dragging wrote straight to the
     * sphere, so the continents moved under a sky that stayed put, and a
     * vertical drag tipped the sphere's `x` while the clouds — aligned once, at
     * load — kept their own forever and slid off the poles for good.
     *
     * A child cannot fall out of step. Whatever turns the planet turns its
     * weather with it, and the only rotation left to apply here is the part
     * that genuinely belongs to the weather alone.
     */
    sphere.add(clouds);
  });

  onResize();
  animate();
  attachEvents();
}

function onResize() {
  if (!renderer || !canvasRef.value || !camera) return;
  const p = canvasRef.value.parentElement;
  const w = p?.clientWidth || canvasRef.value.clientWidth || window.innerWidth;
  const h =
    p?.clientHeight ||
    canvasRef.value.clientHeight ||
    Math.round(window.innerHeight * 0.6);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function scheduleResize() {
  if (resizeScheduled) return;
  resizeScheduled = true;
  requestAnimationFrame(() => {
    resizeScheduled = false;
    onResize();
  });
}

function animate(now = 0) {
  frameId = requestAnimationFrame(animate);
  if (!renderer) return;

  // Time-based rather than per-frame, so the spin is the same speed on a 60Hz
  // panel and a 144Hz one. Clamped because a backgrounded tab resumes with a
  // gap of seconds, which would otherwise snap the globe round.
  const dt = lastFrameAt ? Math.min((now - lastFrameAt) / 1000, 0.1) : 0;
  lastFrameAt = now;

  sphere.rotation.y += SPIN * dt + rotVelY;
  rotVelY *= 0.96;
  if (Math.abs(rotVelY) < 0.00002) rotVelY = 0;

  /**
   * Clouds lead the surface slightly, which is what sells it as weather.
   *
   * Only against the planet's own spin. The lead is wind — the atmosphere
   * outrunning the ground it sits on — and wind does not care that somebody is
   * dragging the globe: a hand on the planet turns the air with it. Applying
   * the lead to the drag as well made the weather overshoot the continents by
   * a tenth of every gesture, which over a few flings walks the whole cloud
   * layer off the map it belongs to.
   *
   * Relative to the sphere now, so this is the extra tenth on its own rather
   * than the full 1.1x.
   */
  if (clouds) clouds.rotation.y += SPIN * dt * CLOUD_LEAD;

  renderer.render(scene, camera);

  if (!firstFrameRendered) {
    firstFrameRendered = true;
    maybeEmitReady();
  }
}

/**
 * Drag to turn.
 *
 * The hero's globe box is `pointer-events-none` — the canvas is wider than the
 * viewport and overlaps the bottom of the waitlist form, so letting it take the
 * pointer would swallow clicks on the submit button. The handlers stay because
 * they belong to the component rather than to this page, and the page is the
 * right place to decide whether the planet is furniture or a control.
 *
 * The window-level listeners are what make a drag survive leaving the canvas;
 * they are registered through `on()` so they come off at unmount.
 */
function attachEvents() {
  const canvas = canvasRef.value!;
  const sens = 0.004;

  const start = (x: number, y: number) => {
    isDragging = true;
    lastX = x;
    lastY = y;
  };
  const move = (x: number, y: number) => {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    sphere.rotation.y += dx * sens;
    sphere.rotation.x = THREE.MathUtils.clamp(
      sphere.rotation.x + dy * sens * 0.2,
      -0.6,
      0.6
    );
    rotVelY = dx * sens * 0.2;
    lastX = x;
    lastY = y;
  };
  const end = () => {
    isDragging = false;
  };

  on(canvas, "mousedown", (e) => start(e.clientX, e.clientY));
  on(window, "mousemove", (e) => move(e.clientX, e.clientY));
  on(window, "mouseup", end);

  on(
    canvas,
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (t) start(t.clientX, t.clientY);
    },
    { passive: true }
  );
  on(
    canvas,
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      // Only claim the gesture when it is predominantly horizontal, so a
      // vertical swipe still scrolls the page past the globe.
      if (Math.abs(t.clientX - lastX) > Math.abs(t.clientY - lastY) * 1.2)
        e.preventDefault();
      move(t.clientX, t.clientY);
    },
    { passive: false }
  );
  on(window, "touchend", end);
}

onMounted(() => {
  const tryInit = () => {
    if (canvasRef.value) init();
    else requestAnimationFrame(tryInit);
  };
  requestAnimationFrame(tryInit);
  on(window, "resize", scheduleResize);

  requestAnimationFrame(() => {
    const parent = canvasRef.value?.parentElement;
    if (!parent) return;
    sizeObserver = new ResizeObserver(scheduleResize);
    sizeObserver.observe(parent);

    /**
     * Stop rendering when the globe is off screen.
     *
     * The hero fills the first viewport, so on this page the observer earns
     * its keep on the tab rather than on the scroll: a lit, textured sphere is
     * otherwise redrawn sixty times a second behind whatever the reader
     * switched to. Purely a pause — nothing about how it looks changes,
     * because when the condition is false the globe is not on screen to look
     * at.
     */
    viewObserver = new IntersectionObserver(([entry]) =>
      entry?.isIntersecting ? play() : pause()
    );
    viewObserver.observe(parent);
  });
});

onBeforeUnmount(() => {
  pause();
  for (const off of teardown) off();
  teardown.length = 0;
  sizeObserver?.disconnect();
  viewObserver?.disconnect();
  renderer?.dispose();
  renderer = null;
});
</script>

<template>
  <div class="relative h-full w-full">
    <canvas ref="canvasRef" class="h-full w-full"></canvas>
  </div>
</template>
