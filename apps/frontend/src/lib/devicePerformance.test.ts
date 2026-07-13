import { describe, expect, it } from "vitest";
import { resolveDevicePerformanceProfile, type DevicePerformanceHints } from "./devicePerformance";

const desktop: DevicePerformanceHints = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  deviceMemory: 16,
  hardwareConcurrency: 12,
  saveData: false,
  effectiveType: "4g",
  reducedMotion: false,
  coarsePointer: false,
  standalone: false,
};

describe("resolveDevicePerformanceProfile", () => {
  it("uses the full profile for capable desktop devices", () => {
    expect(resolveDevicePerformanceProfile(desktop)).toBe("full");
  });

  it("uses the lite profile for Android even on capable hardware", () => {
    expect(resolveDevicePerformanceProfile({ ...desktop, userAgent: "Mozilla/5.0 (Linux; Android 14)" })).toBe("lite");
  });

  it.each([
    { deviceMemory: 4 },
    { hardwareConcurrency: 4 },
    { saveData: true },
    { effectiveType: "2g" },
    { reducedMotion: true },
  ])("uses the lite profile for constrained hints %#", (hint) => {
    expect(resolveDevicePerformanceProfile({ ...desktop, ...hint })).toBe("lite");
  });

  it("uses balanced for a capable standalone touch device", () => {
    expect(resolveDevicePerformanceProfile({ ...desktop, coarsePointer: true, standalone: true })).toBe("balanced");
  });
});
