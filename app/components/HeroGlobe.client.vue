<script setup lang="ts">
import * as THREE from "three";

const emit = defineEmits<{ (e: "ready"): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let sphere: THREE.Mesh;
let earthMat: THREE.MeshStandardMaterial | null = null;
let clouds: THREE.Mesh | null = null;
let cloudsTex: THREE.Texture | null = null;
let oceanTex: THREE.Texture | null = null;
let nightTex: THREE.Texture | null = null;
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
  spinSpeed: 0.1,
  minSpeed: 0.05,
  easingDuration: 5000,
  yOffset: 0.7,
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
  // Ensure sRGB output and slightly brighter tone-mapping
  (renderer as any).outputColorSpace = THREE.SRGBColorSpace as any;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 3.1);

  // Brighter, more stylized lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
  // Angle the sun for a clear day/night terminator
  sunLight.position.set(-2.0, 0.6, 1.5);
  scene.add(sunLight);

  const geometry = new THREE.SphereGeometry(1.06, 192, 192);
  earthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xffffff),
    roughness: 0.95,
    metalness: 0.0,
  });
  // Hook into shader to add cloud shadows, night-only emissive, fresnel, and roughness inversion when maps exist
  earthMat.onBeforeCompile = (shader) => {
    // uniforms for cloud shadowing offset
    shader.uniforms.tClouds = { value: cloudsTex } as any;
    shader.uniforms.uv_xOffset = { value: 0 } as any;
    shader.uniforms.hasClouds = { value: 0 } as any;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n uniform sampler2D tClouds;\n uniform float uv_xOffset;\n uniform float hasClouds;`
    );
    // Roughness map tweak (invert and clamp ocean roughness if provided)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `float roughnessFactor = roughness;\n\n#ifdef USE_ROUGHNESSMAP\n  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n  texelRoughness = vec4(1.0) - texelRoughness;\n  roughnessFactor *= clamp(texelRoughness.g, 0.5, 1.0);\n#endif`
    );
    // Emissive map tweak to show only on night side + cloud shadows + atmospheric fresnel
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#ifdef USE_EMISSIVEMAP\n  vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n#else\n  vec4 emissiveColor = vec4(1.0);\n#endif\n  // Soften the day-night transition for emissive lights\n  float ndotl_em = dot(normal, directionalLights[0].direction);\n  emissiveColor *= 1.0 - smoothstep(-0.20, 0.08, ndotl_em);\n  totalEmissiveRadiance *= emissiveColor.rgb;\n  // subtle surface glow from city lights\n  diffuseColor.rgb += emissiveColor.rgb * 0.35;\n\n  // Cloud negative light map (if clouds texture is bound)\n  #ifdef USE_MAP\n    vec2 uvCloud = vec2(vMapUv.x - uv_xOffset, vMapUv.y);\n    float cloudsMapValue = texture2D(tClouds, uvCloud).r;\n    diffuseColor.rgb *= mix(1.0, max(1.0 - cloudsMapValue, 0.35), hasClouds);\n  #endif\n\n  // Lighter, stylized night shading with a broad soft terminator\n  float ndotl = dot(normal, directionalLights[0].direction);\n  float shade = smoothstep(-0.28, 0.10, ndotl);\n  diffuseColor.rgb *= mix(0.45, 1.0, shade);\n\n  // Boost saturation a bit for a more cartographic look\n  float avg = (diffuseColor.r + diffuseColor.g + diffuseColor.b) / 3.0;\n  diffuseColor.rgb = mix(vec3(avg), diffuseColor.rgb, 1.15);\n\n  // Subtle atmospheric fresnel on surface\n  float intensity = 1.3 - dot( normal, vec3( 0.0, 0.0, 1.0 ) );\n  vec3 atmosphere = vec3(0.35, 0.65, 1.0) * pow(intensity, 5.0) * 0.8;\n  diffuseColor.rgb += atmosphere;`
    );
    // Save shader reference for runtime uniform updates
    (earthMat as any).userData.shader = shader;
  };
  sphere = new THREE.Mesh(geometry, earthMat);
  sphere.rotation.x = 0.18;
  sphere.rotation.y = -0.55;
  scene.add(sphere);

  // ensure clouds (if already created by async loads) are synced to sphere
  if (clouds) {
    clouds.rotation.x = sphere.rotation.x;
    clouds.rotation.y = sphere.rotation.y;
    clouds.position.copy(sphere.position);
  }

  // atmosphere
  const atmoGeo = new THREE.SphereGeometry(1.12, 96, 96);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      atmOpacity: { value: 0.75 },
      atmPowFactor: { value: 4.2 },
      atmMultiplier: { value: 18.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 eyeVector;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        eyeVector = normalize(mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 eyeVector;
      uniform float atmOpacity;
      uniform float atmPowFactor;
      uniform float atmMultiplier;
      void main() {
        float dotP = dot(vNormal, eyeVector);
        float factor = pow(dotP, atmPowFactor) * atmMultiplier;
        vec3 atmColor = vec3(0.35 + dotP/4.5, 0.35 + dotP/4.5, 1.0);
        gl_FragColor = vec4(atmColor, atmOpacity) * factor;
      }
    `,
  });
  atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  scene.add(atmosphere);

  const loader = new THREE.TextureLoader();
  // Albedo (prefer generated WebP/PNG, fallback to bundled)
  const setAlbedo = (tex: THREE.Texture) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (earthMat) {
      earthMat.map = tex;
      earthMat.needsUpdate = true;
    }
    albedoLoaded = true;
    maybeEmitReady();
  };
  loader.load(
    "/textures/globe/earth_albedo.webp",
    (tex) => setAlbedo(tex),
    undefined,
    () => {
      loader.load(
        "/textures/globe/earth_albedo.png",
        (tex) => setAlbedo(tex),
        undefined,
        () => {
          // fallback to bundled texture
          loader.load(
            "/textures/earth-blue-marble.jpg",
            (tex) => setAlbedo(tex),
            undefined,
            () =>
              console.warn(
                "[HeroGlobe] Missing albedo in /textures/globe and bundled"
              )
          );
        }
      );
    }
  );
  // Prefer generated bump + roughness (WebP/PNG)
  const setBump = (tex: THREE.Texture) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (earthMat) {
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.02;
      earthMat.needsUpdate = true;
    }
  };
  loader.load(
    "/textures/globe/earth_bump.webp",
    (tex) => setBump(tex),
    undefined,
    () => {
      loader.load(
        "/textures/globe/earth_bump.png",
        (tex) => setBump(tex),
        undefined,
        () => {
          // fallback to legacy bump, else to bathymetry
          loader.load(
            "/textures/earth_bump.jpg",
            (tex) => setBump(tex),
            undefined,
            () => {
              loader.load(
                "/textures/ne_bathy.png",
                (bathy) => {
                  bathy.wrapS = bathy.wrapT = THREE.ClampToEdgeWrapping;
                  bathy.minFilter = THREE.LinearFilter;
                  if (earthMat) {
                    earthMat.bumpMap = bathy;
                    earthMat.bumpScale = 0.012;
                    earthMat.roughnessMap = bathy;
                    earthMat.metalnessMap = bathy;
                    oceanTex = bathy;
                    earthMat.needsUpdate = true;
                  }
                },
                undefined,
                () =>
                  console.warn("[HeroGlobe] Missing bump maps and bathymetry")
              );
            }
          );
        }
      );
    }
  );

  // Generated roughness map (optional)
  loader.load(
    "/textures/globe/earth_roughness.png",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      if (earthMat) {
        earthMat.roughnessMap = tex;
        earthMat.needsUpdate = true;
      }
    },
    undefined,
    () => {}
  );
  // Night lights (optional)
  loader.load(
    "/textures/night_lights.png",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      if (earthMat) {
        earthMat.emissiveMap = tex;
        earthMat.emissive = new THREE.Color(0xffff88);
        nightTex = tex;
        earthMat.needsUpdate = true;
      }
    },
    undefined,
    () =>
      console.warn(
        "[HeroGlobe] Missing /textures/night_lights.png (night lights disabled)"
      )
  );
  // Clouds layer (optional; prefer WebP)
  const setupClouds = (tex: THREE.Texture) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = false;
    cloudsTex = tex;
    const cloudGeo = new THREE.SphereGeometry(1.062, 160, 160);
    const cloudsMat = new THREE.MeshStandardMaterial({
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
    scene.add(clouds);
    if (earthMat && (earthMat as any).userData.shader) {
      (earthMat as any).userData.shader.uniforms.tClouds.value = tex;
      (earthMat as any).userData.shader.uniforms.hasClouds.value = 1.0;
    }
  };
  loader.load(
    "/textures/globe/clouds.webp",
    (tex) => setupClouds(tex),
    undefined,
    () => {
      loader.load(
        "/textures/clouds.png",
        (tex) => setupClouds(tex),
        undefined,
        () => {
          // Fallback: generate procedural clouds
          console.warn(
            "[HeroGlobe] Missing clouds textures, generating procedural clouds"
          );
          const tex = generateCloudsTexture(1024, 512);
          setupClouds(tex);
        }
      );
    }
  );

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
  const k = Math.min(1, t / state.easingDuration);
  const speed = state.spinSpeed * (1 - k) + state.minSpeed * k;
  const deltaY = speed * (1 / 60) + rotVelY;
  sphere.rotation.y += deltaY;
  rotVelY *= 0.96;
  if (Math.abs(rotVelY) < 0.00002) rotVelY = 0;
  const ek = Math.min(1, t / 1200.0);
  const ease = 1.0 - Math.pow(1.0 - ek, 3.0);
  sphere.position.y = (-state.yOffset + ease * state.yOffset) * 1.05;
  if (atmosphere) {
    atmosphere.position.copy(sphere.position);
  }
  // rotate clouds faster and keep them attached to sphere position
  if (clouds) {
    clouds.rotation.y += deltaY * 1.1;
    clouds.position.copy(sphere.position);
  }
  if (earthMat && (earthMat as any).userData.shader && cloudsTex) {
    const shader = (earthMat as any).userData.shader;
    shader.uniforms.uv_xOffset.value =
      (shader.uniforms.uv_xOffset.value + deltaY / (Math.PI * 2)) % 1;
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
