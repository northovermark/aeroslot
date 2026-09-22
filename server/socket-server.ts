/** Optional, separately deployed Node event gateway. Not used by the hosted site. */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { Server } from "socket.io";

const origin = process.env.WEB_ORIGIN;
const eventToken = process.env.INTERNAL_EVENT_TOKEN;
if (!origin || !eventToken || eventToken.length < 32) {
  throw new Error("Set WEB_ORIGIN and a random INTERNAL_EVENT_TOKEN (at least 32 characters)");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: origin.split(",").map(value => value.trim()) } });

function authorized(value: string | undefined) {
  if (!value?.startsWith("Bearer ")) return false;
  const received = Buffer.from(value.slice(7));
  const expected = Buffer.from(eventToken!);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

app.get("/health", (_request, response) => response.json({ ok: true }));
app.post("/internal/inventory/changed", (request, response) => {
  if (!authorized(request.header("authorization"))) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { source, revision } = request.body ?? {};
  if (typeof source !== "string" || !/^[a-z0-9_-]{2,40}$/.test(source) ||
      typeof revision !== "string" || revision.length > 80 || !revision) {
    response.status(400).json({ error: "Invalid event" });
    return;
  }
  // Only a refresh hint is public. Clients re-fetch canonical inventory via the API.
  io.emit("inventory:refresh", { source, revision });
  response.status(202).json({ accepted: true });
});

http.listen(Number(process.env.PORT || 4001));
