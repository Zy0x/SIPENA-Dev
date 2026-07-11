import { useEffect, useState } from "react";

type NavigatorWithHints = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
};

export function shouldUseLightMotion(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const nav = navigator as NavigatorWithHints;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const saveData = nav.connection?.saveData === true;
  const slowConnection = nav.connection?.effectiveType === "slow-2g" || nav.connection?.effectiveType === "2g";
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const lowCpu = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;

  return reduced || coarse || saveData || slowConnection || lowMemory || lowCpu;
}

export function useAdaptiveMotion(): boolean {
  const [lightMotion, setLightMotion] = useState(shouldUseLightMotion);

  useEffect(() => {
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setLightMotion(shouldUseLightMotion());

    reducedQuery.addEventListener("change", update);
    pointerQuery.addEventListener("change", update);
    window.addEventListener("online", update);

    return () => {
      reducedQuery.removeEventListener("change", update);
      pointerQuery.removeEventListener("change", update);
      window.removeEventListener("online", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motionProfile = lightMotion ? "light" : "full";
  }, [lightMotion]);

  return lightMotion;
}
