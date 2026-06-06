export type ViewportProfile =
  | "mobile-small"
  | "mobile-regular"
  | "mobile-large"
  | "mobile-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop";

export interface ViewportSafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportTelemetrySnapshot {
  route_path: string;
  viewport_profile: ViewportProfile;
  viewport_width: number;
  viewport_height: number;
  visual_viewport_width: number | null;
  visual_viewport_height: number | null;
  visual_viewport_offset_top: number | null;
  visual_viewport_offset_left: number | null;
  screen_width: number | null;
  screen_height: number | null;
  screen_avail_width: number | null;
  screen_avail_height: number | null;
  device_pixel_ratio: number | null;
  orientation: "portrait" | "landscape" | "unknown";
  display_mode: "browser" | "standalone" | "fullscreen" | "minimal-ui" | "unknown";
  touch_points: number;
  safe_area_top: number;
  safe_area_right: number;
  safe_area_bottom: number;
  safe_area_left: number;
  has_display_cutout: boolean;
  viewport_key: string;
}

const SAFE_AREA_INSET_NAMES: Record<keyof ViewportSafeArea, string> = {
  top: "safe-area-inset-top",
  right: "safe-area-inset-right",
  bottom: "safe-area-inset-bottom",
  left: "safe-area-inset-left",
};

function round(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function roundRatio(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function readSafeAreaInset(property: keyof ViewportSafeArea): number {
  if (typeof document === "undefined" || !document.body) return 0;

  const probe = document.createElement("div");
  const cssProperty =
    property === "top"
      ? "paddingTop"
      : property === "right"
        ? "paddingRight"
        : property === "bottom"
          ? "paddingBottom"
          : "paddingLeft";

  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style[cssProperty] = `env(${SAFE_AREA_INSET_NAMES[property]})`;
  document.body.appendChild(probe);
  const value = parseFloat(window.getComputedStyle(probe)[cssProperty] || "0");
  probe.remove();

  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function readViewportSafeArea(): ViewportSafeArea {
  return {
    top: readSafeAreaInset("top"),
    right: readSafeAreaInset("right"),
    bottom: readSafeAreaInset("bottom"),
    left: readSafeAreaInset("left"),
  };
}

export function getViewportProfile(width: number, height: number): ViewportProfile {
  const shortestSide = Math.min(width, height);
  const isLandscape = width > height;

  if (width >= 1180 && height >= 640) return "desktop";
  if (isLandscape && height < 480) return "mobile-landscape";
  if (shortestSide < 360) return "mobile-small";
  if (shortestSide < 430 && !isLandscape) return "mobile-regular";
  if (shortestSide < 640) return isLandscape ? "mobile-landscape" : "mobile-large";
  if (shortestSide < 960) return isLandscape ? "tablet-landscape" : "tablet-portrait";
  return "desktop";
}

function getDisplayMode(): ViewportTelemetrySnapshot["display_mode"] {
  if (typeof window === "undefined") return "unknown";
  if (typeof document !== "undefined" && document.fullscreenElement) return "fullscreen";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "standalone";
  if (window.matchMedia?.("(display-mode: fullscreen)").matches) return "fullscreen";
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return "minimal-ui";
  if (window.matchMedia?.("(display-mode: browser)").matches) return "browser";
  return "unknown";
}

export function captureViewportTelemetrySnapshot(routePath = "/"): ViewportTelemetrySnapshot {
  if (typeof window === "undefined") {
    return {
      route_path: routePath || "/",
      viewport_profile: "desktop",
      viewport_width: 0,
      viewport_height: 0,
      visual_viewport_width: null,
      visual_viewport_height: null,
      visual_viewport_offset_top: null,
      visual_viewport_offset_left: null,
      screen_width: null,
      screen_height: null,
      screen_avail_width: null,
      screen_avail_height: null,
      device_pixel_ratio: null,
      orientation: "unknown",
      display_mode: "unknown",
      touch_points: 0,
      safe_area_top: 0,
      safe_area_right: 0,
      safe_area_bottom: 0,
      safe_area_left: 0,
      has_display_cutout: false,
      viewport_key: "desktop|0x0|s0x0|dpr1|safe0-0-0-0|unknown",
    };
  }

  const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
  const viewportWidth = round(visualViewport?.width ?? window.innerWidth) ?? 0;
  const viewportHeight = round(visualViewport?.height ?? window.innerHeight) ?? 0;
  const screenWidth = typeof screen !== "undefined" ? round(screen.width) : null;
  const screenHeight = typeof screen !== "undefined" ? round(screen.height) : null;
  const screenAvailWidth = typeof screen !== "undefined" ? round(screen.availWidth) : null;
  const screenAvailHeight = typeof screen !== "undefined" ? round(screen.availHeight) : null;
  const safeArea = readViewportSafeArea();
  const visualOffsetTop = round(visualViewport?.offsetTop);
  const visualOffsetLeft = round(visualViewport?.offsetLeft);
  const hasDisplayCutout =
    safeArea.top > 0 ||
    safeArea.right > 0 ||
    safeArea.bottom > 0 ||
    safeArea.left > 0 ||
    (visualOffsetTop ?? 0) > 0 ||
    (visualOffsetLeft ?? 0) > 0;
  const orientation =
    viewportWidth === viewportHeight ? "unknown" : viewportWidth > viewportHeight ? "landscape" : "portrait";
  const viewportProfile = getViewportProfile(viewportWidth, viewportHeight);
  const displayMode = getDisplayMode();
  const dpr = roundRatio(window.devicePixelRatio);

  const viewportKey = [
    viewportProfile,
    `${viewportWidth}x${viewportHeight}`,
    `s${screenWidth ?? 0}x${screenHeight ?? 0}`,
    `dpr${dpr ?? 1}`,
    `safe${safeArea.top}-${safeArea.right}-${safeArea.bottom}-${safeArea.left}`,
    displayMode,
  ].join("|");

  return {
    route_path: routePath || "/",
    viewport_profile: viewportProfile,
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    visual_viewport_width: round(visualViewport?.width),
    visual_viewport_height: round(visualViewport?.height),
    visual_viewport_offset_top: visualOffsetTop,
    visual_viewport_offset_left: visualOffsetLeft,
    screen_width: screenWidth,
    screen_height: screenHeight,
    screen_avail_width: screenAvailWidth,
    screen_avail_height: screenAvailHeight,
    device_pixel_ratio: dpr,
    orientation,
    display_mode: displayMode,
    touch_points: typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0,
    safe_area_top: safeArea.top,
    safe_area_right: safeArea.right,
    safe_area_bottom: safeArea.bottom,
    safe_area_left: safeArea.left,
    has_display_cutout: hasDisplayCutout,
    viewport_key: viewportKey,
  };
}

export function applyViewportCssVariables(snapshot: ViewportTelemetrySnapshot, target = document.documentElement) {
  target.style.setProperty("--sipena-viewport-width", `${snapshot.viewport_width}px`);
  target.style.setProperty("--sipena-viewport-height", `${snapshot.viewport_height}px`);
  target.style.setProperty(
    "--sipena-visual-viewport-width",
    `${snapshot.visual_viewport_width ?? snapshot.viewport_width}px`,
  );
  target.style.setProperty(
    "--sipena-visual-viewport-height",
    `${snapshot.visual_viewport_height ?? snapshot.viewport_height}px`,
  );
  target.style.setProperty("--sipena-safe-top", `${snapshot.safe_area_top}px`);
  target.style.setProperty("--sipena-safe-right", `${snapshot.safe_area_right}px`);
  target.style.setProperty("--sipena-safe-bottom", `${snapshot.safe_area_bottom}px`);
  target.style.setProperty("--sipena-safe-left", `${snapshot.safe_area_left}px`);
  target.dataset.sipenaDisplayCutout = snapshot.has_display_cutout ? "true" : "false";
}

export function clearViewportCssVariables(target = document.documentElement) {
  [
    "--sipena-viewport-width",
    "--sipena-viewport-height",
    "--sipena-visual-viewport-width",
    "--sipena-visual-viewport-height",
    "--sipena-safe-top",
    "--sipena-safe-right",
    "--sipena-safe-bottom",
    "--sipena-safe-left",
  ].forEach((name) => target.style.removeProperty(name));
  delete target.dataset.sipenaDisplayCutout;
}
