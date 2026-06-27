import type { AttendanceShadowReport } from "../attendance.types";

export class AttendanceShadowService {
  getReport(): AttendanceShadowReport {
    return {
      enabled: false,
      mismatchCount: 0,
      reports: [],
    };
  }
}
