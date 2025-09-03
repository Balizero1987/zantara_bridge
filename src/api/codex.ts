import express from "express";
import crypto from "crypto";
import { Queue, Worker, Job } from "bullmq";
import { ok, fail } from "../core/output";

const router = express.Router();
const REDIS_URL = process.env.REDIS_URL || undefined;

type CodexJob = {
  request_id: string;
  event_type: string;
  payload: any;
  context?: any;
};

const JOB_PREFIX = "codex:";
const inMemoryStore = new Map<string, any>();
const inMemoryQueue: CodexJob[] = [];
let queue: Queue | null = null;
if (REDIS_URL) {
  queue = new Queue("codex-tasks", { connection: { url: REDIS_URL } });
}

// helper - generate id
function makeId() {
  return "rq_" + crypto.randomBytes(6).toString("hex");
}

// push job (queue or memory)
async function pushJob(job: CodexJob) {
  if (queue) {
    await queue.add(job.event_type, job, { jobId: job.request_id });
    return;
  }
  inMemoryQueue.push(job);
  // start background runner
  setTimeout(() => runInMemory(), 50);
}

async function runInMemory() {
  if (!inMemoryQueue.length) return;
  const job = inMemoryQueue.shift()!;
  inMemoryStore.set(job.request_id, { status: "running" });
  try {
    // CALL YOUR CODEX ENDPOINT HERE
    // Example: call internal Codex service
    const CODEX_URL = process.env.CODEX_URL;
    const CODEX_TOKEN = process.env.CODEX_TOKEN;
    let output = { summary: "dry-run: no CODEX_URL configured" };
    if (CODEX_URL) {
      const resp = await fetch(CODEX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${CODEX_TOKEN || ""}` },
        body: JSON.stringify({ intent: job.event_type, input: job.payload, context: job.context || {} })
      });
      output = await resp.json();
    }
    inMemoryStore.set(job.request_id, { status: "done", output });
  } catch (err: any) {
    inMemoryStore.set(job.request_id, { status: "error", error: String(err) });
  }
}

// Worker (Redis) to process jobs and store result in Redis or fallback inMemoryStore
if (queue) {
  const worker = new Worker("codex-tasks", async (job: Job) => {
    const data = job.data as CodexJob;
    const request_id = data.request_id;
    try {
      // call CODEX service
      const CODEX_URL = process.env.CODEX_URL;
      const CODEX_TOKEN = process.env.CODEX_TOKEN;
      let output = { summary: "dry-run: no CODEX_URL configured" };
      if (CODEX_URL) {
        const resp = await fetch(CODEX_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CODEX_TOKEN || ""}` },
          body: JSON.stringify({ intent: data.event_type, input: data.payload, context: data.context || {} })
        });
        output = await resp.json();
      }
      // store in Redis via job.returnvalue (Bull stores)
      return { status: "done", output };
    } catch (e: any) {
      throw new Error(String(e));
    }
  }, { connection: { url: REDIS_URL } });
}

router.post("/dispatch", async (req, res) => {
  const idemKey = req.header("X-Idempotency-Key");
  if (!idemKey) return res.status(400).json(fail("Missing X-Idempotency-Key"));

  const { event_type, payload, context } = req.body || {};
  if (!event_type || !payload) return res.status(400).json(fail("Missing event_type or payload"));

  const request_id = makeId();
  const job: CodexJob = { request_id, event_type, payload, context };

  // store a lightweight "queued" record
  if (queue) {
    // add to queue (jobId = request_id ensures idempotence at queue level)
    try {
      await queue.add(event_type, job, { jobId: request_id });
      // optional: set TTL store in Redis handled by Bull; reply
      return res.status(202).json(ok({ request_id, status: "queued" }));
    } catch (e: any) {
      return res.status(500).json(fail(String(e)));
    }
  }

  // fallback: memory
  inMemoryStore.set(request_id, { status: "queued" });
  await pushJob(job);
  return res.status(202).json(ok({ request_id, status: "queued" }));
});

router.get("/status/:request_id", async (req, res) => {
  const id = req.params.request_id;
  if (!id) return res.status(400).json(fail("Missing request_id"));

  // Redis/Bull check
  if (queue && queue.client) {
    try {
      const job = await queue.getJob(id);
      if (!job) {
        // maybe finished and removed. try get from completed (Bull may purge)
        // fallback to "not found"
        return res.status(404).json(fail("not_found"));
      }
      const state = await job.getState();
      if (state === "completed") {
        const rv = job.returnvalue || {};
        return res.json(ok({ request_id: id, status: "done", output: rv.output || rv }));
      }
      if (state === "failed") {
        return res.json(ok({ request_id: id, status: "error", error: job.failedReason || "failed" }));
      }
      return res.json(ok({ request_id: id, status: state === "active" ? "running" : "queued" }));
    } catch (e: any) {
      return res.status(500).json(fail(String(e)));
    }
  }

  // Memory fallback
  const rec = inMemoryStore.get(id);
  if (!rec) return res.status(404).json(fail("not_found"));
  return res.json(ok({ request_id: id, status: rec.status, output: rec.output, error: rec.error }));
});

export default router;
