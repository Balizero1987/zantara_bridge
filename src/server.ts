import express from "express";
import router from "./chatRouter";
import identity, { requireIdentity } from "./api/identity";
import gmail from "./api/gmail";
import memory from "./api/memory";

const app = express();
app.use(express.json());

// Rotte principali (Codex, Drive, Calendar…)
app.use(router);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, service: "zantara-bridge" }));

// Identity (login/me)
app.use(identity);

// Azioni che richiedono login AMBARADAM
app.use("/actions/gmail", requireIdentity, gmail);
app.use("/actions/memory", requireIdentity, memory);

// Porta
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on", port));

export default app;
