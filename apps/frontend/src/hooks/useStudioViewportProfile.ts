import { useEffect, useMemo, useState, type RefObject } from "react";

export type StudioViewportProfile =
  | "phone-compact"
  | "phone-regular"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop";

export interface StudioViewportState {
  layoutWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  profile: StudioViewportProfile;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isCompactPhone: boolean;
  isLandscape: boolean;
}

function getViewportSnapshot(targetWidth: number) {
  const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
  const viewportWidth = Math.round(visualViewport?.width ?? window.innerWidth ?? targetWidth);
  const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight ?? 0);
  const layoutWidth = Math.round(targetWidth || viewportWidth);
  const isLandscape = viewportWidth > viewportHeight;

  let profile: StudioViewportProfile;
  if (layoutWidth < 360) {
    profile = "phone-compact";
  } else if (layoutWidth < 640) {
    profile = "phone-regular";
  } else if (layoutWidth < 960) {
    profile = isLandscape ? "tablet-landscape" : "tablet-portrait";
  } else {
    profile = "desktop";
  }

  return {
    layoutWidth,
    viewportWidth,
    viewportHeight,
    profile,
    isPhone: profile === "phone-compact" || profile === "phone-regular",
    isTablet: profile === "tablet-portrait" || profile === "tablet-landscape",
    isDesktop: profile === "desktop",
    isCompactPhone: profile === "phone-compact",
    isLandscape,
  } satisfies StudioViewportState;
}

export function useStudioViewportProfile(
  targetRef?: RefObject<HTMLElement | null>,
  enabled = true,
): StudioViewportState {
  const fallback = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        layoutWidth: 1280,
        viewportWidth: 1280,
        viewportHeight: 800,
        profile: "desktop",
        isPhone: false,
        isTablet: false,
        isDesktop: true,
        isCompactPhone: false,
        isLandscape: true,
      } satisfies StudioViewportState;
    }

    return getViewportSnapshot(window.innerWidth);
  }, []);

  const [snapshot, setSnapshot] = useState<StudioViewportState>(fallback);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    const targetNode = targetRef?.current ?? null;
    const readTargetWidth = () => Math.round(targetNode?.clientWidth || window.innerWidth);
    const updateSnapshot = () => setSnapshot(getViewportSnapshot(readTargetWidth()));

    updateSnapshot();

    const visualViewport = window.visualViewport;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && targetNode
        ? new ResizeObserver(() => updateSnapshot())
        : null;

    resizeObserver?.observe(targetNode as Element);
    window.addEventListener("resize", updateSnapshot);
    window.addEventListener("orientationchange", updateSnapshot);
    visualViewport?.addEventListener("resize", updateSnapshot);
    visualViewport?.addEventListener("scroll", updateSnapshot);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateSnapshot);
      window.removeEventListener("orientationchange", updateSnapshot);
      visualViewport?.removeEventListener("resize", updateSnapshot);
      visualViewport?.removeEventListener("scroll", updateSnapshot);
    };
  }, [enabled, targetRef]);

  return snapshot;
}
