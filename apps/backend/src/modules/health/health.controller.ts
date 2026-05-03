import type { IncomingMessage, ServerResponse } from "node:http";
import { getHealth } from "./health.service";

export function healthController(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ data: getHealth() }));
}
