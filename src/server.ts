import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import codexRouter from "./api/codex";
import { rateLimit } from "./middleware/rateLimit";
import { loggingMiddleware } from "./middleware/logging";
import { ok, fail } from "./core/output";

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

// global logging + rate limit
app.use(loggingMiddleware);
app.use(rateLimit({ limit: Number(process.env.RATE_LIMIT || 120), windowMs: 60_000 }));

// cors allowlist
const allowed = (process.env.CORS_ALLOWED || "https://app.balizero.com").split(",").map(s => s.trim());
app.use(cors({ origin: (origin: any, cb: any) => {
  if (!origin) return cb(null, true); // allow server-to-server
  if (allowed.includes(origin) || allowed.some((r: string) => r && new RegExp(r).test(origin))) return cb(null, true);
  return cb(new Error("Not allowed by CORS"));
}, credentials: true }));

// mount codex endpoints under /actions/codex
app.use("/actions/codex", codexRouter);

// existing mounts...

// simple health check
app.get("/health", (_req, res) => res.json(ok("ok")));

// catch-all error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("unhandled", err);
  return res.status(err?.status || 500).json(fail(err?.message || "internal_error"));
});

export default app;

if (require.main === module) {
  const PORT = Number(process.env.PORT || 8080);
  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}
