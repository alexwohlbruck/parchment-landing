import { ref, onBeforeUnmount } from "vue";
import { gsap } from "gsap";

export function useGlobeMover() {
  const globeRef = ref<HTMLDivElement | null>(null);
  const activeTarget = ref<HTMLElement | null>(null);
  let rootEl: HTMLElement | null = null;
  let alignScheduled = false;

  // Base size initialized from the first rect we see
  let baseWidth: number | null = null;
  let baseHeight: number | null = null;

  // GSAP quick setters for ultra-fast updates
  let setX: ((v: number) => any) | null = null;
  let setY: ((v: number) => any) | null = null;
  let setSX: ((v: number) => any) | null = null;
  let setSY: ((v: number) => any) | null = null;

  function ensureSetters() {
    const globe = globeRef.value;
    if (!globe) return false;
    if (!setX || !setY || !setSX || !setSY) {
      // Animate to new values smoothly; subsequent calls retarget the same tween
      setX = gsap.quickTo(globe, "x", { duration: 2, ease: "power2" });
      setY = gsap.quickTo(globe, "y", { duration: 2, ease: "power2" });
      setSX = gsap.quickTo(globe, "scaleX", {
        duration: 2,
        ease: "power2",
      });
      setSY = gsap.quickTo(globe, "scaleY", {
        duration: 2,
        ease: "power2",
      });
    }
    return true;
  }

  function initBaseIfNeeded(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    const globe = globeRef.value;
    if (!globe) return;
    if (baseWidth == null || baseHeight == null) {
      baseWidth = Math.max(1, Math.round(rect.width));
      baseHeight = Math.max(1, Math.round(rect.height));
      globe.style.width = `${baseWidth}px`;
      globe.style.height = `${baseHeight}px`;
      globe.style.left = "0px";
      globe.style.top = "0px";
      globe.style.transformOrigin = "0 0";
      globe.style.willChange = "transform";
    }
  }

  function toRect(
    rect: { left: number; top: number; width: number; height: number },
    animate: boolean
  ) {
    if (!ensureSetters()) return;
    initBaseIfNeeded(rect);
    if (baseWidth == null || baseHeight == null) return;

    const x = rect.left;
    const y = rect.top;
    const sx = rect.width / baseWidth;
    const sy = rect.height / baseHeight;

    if (!animate) {
      gsap.set(globeRef.value!, { x, y, scaleX: sx, scaleY: sy });
      return;
    }

    setX!(x);
    setY!(y);
    setSX!(sx);
    setSY!(sy);
  }

  const positionGlobeToRect = (
    rect: { left: number; top: number; width: number; height: number },
    animate: boolean
  ) => {
    toRect(rect, animate);
  };

  const positionGlobe = (target: HTMLElement, animate: boolean) => {
    const r = target.getBoundingClientRect();
    positionGlobeToRect(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      animate
    );
  };

  const keepAligned = () => {
    if (alignScheduled) return;
    alignScheduled = true;
    requestAnimationFrame(() => {
      alignScheduled = false;
      const target = activeTarget.value;
      if (!target) return;
      const r = target.getBoundingClientRect();
      // Follow target smoothly during scroll/resize
      toRect(
        { left: r.left, top: r.top, width: r.width, height: r.height },
        true
      );
    });
  };

  const attach = (root: HTMLElement) => {
    rootEl = root;
    root.addEventListener("scroll", keepAligned, { passive: true });
    window.addEventListener("resize", keepAligned);
  };
  const detach = () => {
    rootEl?.removeEventListener("scroll", keepAligned as any);
    window.removeEventListener("resize", keepAligned);
  };

  onBeforeUnmount(detach);

  return {
    globeRef,
    activeTarget,
    positionGlobe,
    positionGlobeToRect,
    attach,
    detach,
  };
}
