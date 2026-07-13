import { describe, expect, it } from "vitest";
import { resolveRouteModuleKey } from "./routePreload";

describe("route preload registry", () => {
  it("maps protected and report routes to their lazy modules", () => {
    expect(resolveRouteModuleKey("/dashboard")).toBe("dashboard");
    expect(resolveRouteModuleKey("/classes/")).toBe("classes");
    expect(resolveRouteModuleKey("/attendance")).toBe("attendanceStable");
    expect(resolveRouteModuleKey("/reports/rankings")).toBe("rankings");
    expect(resolveRouteModuleKey("/settings/profile")).toBe("profile");
  });

  it("maps dynamic and shared modules without guessing unknown routes", () => {
    expect(resolveRouteModuleKey("/portal/ABC123")).toBe("portalView");
    expect(resolveRouteModuleKey("/guest/grades")).toBe("grades");
    expect(resolveRouteModuleKey("/unknown-page")).toBeNull();
  });
});
