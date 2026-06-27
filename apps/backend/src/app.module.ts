import { createServer } from "node:http";
import { attendanceController } from "./modules/attendance/attendance.controller";
import { healthController } from "./modules/health/health.controller";

export function createApp() {
  return createServer(async (req, res) => {
    if (req.url === "/api/health") return healthController(req, res);
    if (req.url?.startsWith("/api/attendance")) {
      const handled = await attendanceController(req, res);
      if (handled) return;
    }
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  });
}
