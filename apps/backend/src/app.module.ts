import { createServer } from "node:http";
import { healthController } from "./modules/health/health.controller";

export function createApp() {
  return createServer((req, res) => {
    if (req.url === "/api/health") return healthController(req, res);
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  });
}
