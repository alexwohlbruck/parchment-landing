<script setup lang="ts">
import * as THREE from "three";

const emit = defineEmits<{ (e: "ready"): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let sphere: THREE.Mesh;
let tiltGroup: THREE.Group | null = null;
let earthMat!: THREE.ShaderMaterial;
let clouds: THREE.Mesh | null = null;
let cloudsTex: THREE.Texture | null = null;
let atmosphere: THREE.Mesh | null = null;
let frameId: number | null = null;
let sizeObserver: ResizeObserver | null = null;
let resizeScheduled = false;
let albedoLoaded = false;
let firstFrameRendered = false;
let readyEmitted = false;
function maybeEmitReady() {
  if (!readyEmitted && albedoLoaded && firstFrameRendered) {
    readyEmitted = true;
    emit("ready");
  }
}

function generateCloudsTexture(
  width = 1024,
  height = 512
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  // Simple fractal value noise
  const rand = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    let n = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
      const sx = Math.floor(x * freq);
      const sy = Math.floor(y * freq);
      n += rand(sx, sy) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return n;
  };
  let p = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = noise(x / width, y / height);
      const a = Math.max(0, Math.min(1, (n - 0.5) / 0.15));
      img.data[p++] = 255;
      img.data[p++] = 255;
      img.data[p++] = 255;
      img.data[p++] = Math.floor(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  (tex as any).flipY = false;
  return tex;
}

const state = reactive({
  startedAt: 0,
  // Use a single steady spin speed; no intro easing
  minSpeed: 0.05,
});

// interaction state
let isDragging = false;
let lastX = 0;
let lastY = 0;
let rotVelY = 0; // inertia (radians per frame)
let prevScrollY = 0;

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
  (renderer as any).outputColorSpace = THREE.SRGBColorSpace as any;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 3.1);

  // Group to apply Earth's axial tilt
  tiltGroup = new THREE.Group();
  // Earth's axial tilt is ~23.5 degrees
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
  scene.add(tiltGroup);

  const geometry = new THREE.SphereGeometry(1.06, 192, 192);
  earthMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      glowIntensity: { value: 0.8 },
      glowPower: { value: 3.0 },
      shadowIntensity: { value: 0.5 },
      time: { value: 0.0 },
      edgeStart: { value: 0.1 }, // where inner shadow begins near rim
      edgeEnd: { value: 0.9 }, // where inner shadow reaches full strength
      noiseAmount: { value: 1 },
      shadowColor: { value: new THREE.Color().setHex(0xf4dab2) },
      grainScale: { value: 900.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float glowIntensity;
      uniform float glowPower;
      uniform float shadowIntensity;
      uniform float time;
      uniform float edgeStart;
      uniform float edgeEnd;
      uniform float noiseAmount;
      uniform vec3 shadowColor;
      uniform float grainScale;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // Hash-based grain: high-frequency, non-interpolated noise anchored to UVs
      float hash21(vec2 p){
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }
      
      void main() {
        vec4 texColor = texture2D(map, vUv);
        
        // Fresnel term relative to camera for rim effects
        float fresnel = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
        fresnel = clamp(fresnel, 0.0, 1.0);
        
        // Outer atmospheric glow (additive)
        vec3 glow = vec3(0.8, 0.9, 1.0) * pow(fresnel, glowPower) * glowIntensity;
        
        // Inner rim shadow with grain
        float edge = smoothstep(edgeStart, edgeEnd, fresnel);
        float g = hash21(vUv * grainScale);
        // Center grain around 0 with adjustable strength
        float grain = (g - 0.5) * 2.0; // [-1,1]
        float shadowFactor = edge * shadowIntensity * clamp(0.9 + noiseAmount * grain, 0.0, 2.0);
        vec3 shaded = mix(texColor.rgb, shadowColor, clamp(shadowFactor, 0.0, 1.0));
        
        vec3 finalColor = shaded + glow;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  }) as any;
  sphere = new THREE.Mesh(geometry, earthMat);
  // Start with a pleasing facing angle, rotation around local Y for spin
  sphere.rotation.x = 0.0;
  sphere.rotation.y = -0.55;
  tiltGroup.add(sphere);

  // Add outer atmospheric glow
  const atmoGeo = new THREE.SphereGeometry(1.23, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(1.5, 1.3, 1.4) },
      viewVector: { value: camera.position },
    },
    vertexShader: `
      uniform vec3 viewVector;
      varying float intensity;
      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vNormel = normalize(normalMatrix * viewVector);
        intensity = pow(0.7 - dot(vNormal, vNormel), 4.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying float intensity;
      void main() {
        vec3 glow = glowColor * intensity;
        gl_FragColor = vec4(glow, intensity * 1.2);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  atmosphere.position.copy(sphere.position);
  atmosphere.renderOrder = 1; // Ensure it renders after other objects
  tiltGroup.add(atmosphere);

  // ensure clouds (if already created by async loads) are synced to sphere
  if (clouds) {
    clouds.rotation.x = sphere.rotation.x;
    clouds.rotation.y = sphere.rotation.y;
    clouds.position.copy(sphere.position);
  }

  const loader = new THREE.TextureLoader();
  // Albedo (prefer generated WebP/PNG, fallback to bundled)
  const setAlbedo = (tex: THREE.Texture) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    (earthMat as any).uniforms.map.value = tex;
    earthMat.needsUpdate = true;
    albedoLoaded = true;
    maybeEmitReady();
  };
  loader.load("/textures/earth_albedo.png", (tex) => setAlbedo(tex));

  // Clouds layer (optional; prefer WebP)
  const setupClouds = (tex: THREE.Texture) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = false;
    cloudsTex = tex;
    const cloudGeo = new THREE.SphereGeometry(1.062, 160, 160);
    const cloudsMat = new THREE.MeshBasicMaterial({
      alphaMap: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.98,
      color: new THREE.Color(0xffffff),
    });
    clouds = new THREE.Mesh(cloudGeo, cloudsMat);
    clouds.rotation.x = sphere.rotation.x;
    clouds.rotation.y = sphere.rotation.y;
    clouds.position.copy(sphere.position);
    tiltGroup!.add(clouds);
  };
  loader.load("/textures/clouds.jpg", (tex) => setupClouds(tex));

  state.startedAt = performance.now();
  onResize();
  animate();
  attachEvents();
}

function onResize() {
  if (!renderer || !canvasRef.value || !camera) return;
  const p = canvasRef.value.parentElement;
  const w = p?.clientWidth || canvasRef.value.clientWidth || innerWidth;
  const h =
    p?.clientHeight ||
    canvasRef.value.clientHeight ||
    Math.round(innerHeight * 0.6);
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

function animate() {
  frameId = requestAnimationFrame(animate);
  if (!renderer) return;
  const t = performance.now() - state.startedAt;
  const speed = state.minSpeed;
  const deltaY = speed * (1 / 60) + rotVelY;
  // Spin around the tilted axis by rotating the sphere about its local Y
  sphere.rotation.y += deltaY;
  rotVelY *= 0.96;
  if (Math.abs(rotVelY) < 0.00002) rotVelY = 0;
  // No intro lift animation; keep Y position fixed
  if (sphere.position.y !== 0) sphere.position.y = 0;

  // Keep atmosphere attached to sphere
  if (atmosphere) {
    atmosphere.position.copy(sphere.position);
  }

  // rotate clouds faster and keep them attached to sphere position
  if (clouds) {
    clouds.rotation.y += deltaY * 1.1;
    clouds.position.copy(sphere.position);
  }

  // Update time uniform for subtle noise animation
  if (earthMat && (earthMat as any).uniforms) {
    (earthMat as any).uniforms.time.value = t * 0.001;
  }

  renderer.render(scene, camera);
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    maybeEmitReady();
  }
}

function attachEvents() {
  const canvas = canvasRef.value!;
  const sens = 0.004;
  const onDown = (x: number, y: number) => {
    isDragging = true;
    lastX = x;
    lastY = y;
  };
  const onMove = (x: number, y: number, isTouch = false) => {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    // Only prevent default on predominantly horizontal drags (for touch)
    if (isTouch && Math.abs(dx) > Math.abs(dy) * 1.2) {
      // preventDefault will be called by the touch handler wrapper
    }
    // Rotate around spin axis (local Y) and slightly pitch for feel
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
  const onUp = () => {
    isDragging = false;
  };

  // mouse
  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);
  // touch
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      onDown(t.clientX, t.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (horizontal) e.preventDefault();
      onMove(t.clientX, t.clientY, true);
    },
    { passive: false }
  );
  window.addEventListener("touchend", onUp);

  // scroll-linked spin
  const onScroll = () => {
    const y = window.scrollY;
    const dy = y - prevScrollY;
    prevScrollY = y;
    sphere.rotation.y += dy * 0.0006;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

onMounted(() => {
  const tryInit = () => {
    if (canvasRef.value) init();
    else requestAnimationFrame(tryInit);
  };
  requestAnimationFrame(tryInit);
  addEventListener("resize", scheduleResize);
  // track container size changes (globe frame animates)
  requestAnimationFrame(() => {
    const parent = canvasRef.value?.parentElement;
    if (!parent) return;
    sizeObserver = new ResizeObserver(() => scheduleResize());
    sizeObserver.observe(parent);
  });
});
onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId);
  removeEventListener("resize", scheduleResize);
  sizeObserver?.disconnect();
  renderer?.dispose();
  renderer = null;
});
</script>

<template>
  <div class="relative h-full w-full">
    <canvas ref="canvasRef" class="h-full w-full"></canvas>
  </div>
</template>

<style scoped>
:host,
.h-full {
  height: 100%;
}
</style>
