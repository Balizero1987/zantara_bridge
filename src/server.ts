import express from "express";
import router from "./chatRouter";
import identity from "./api/identity";
import { apiKeyGuard } from "./middleware/authPlugin";
import gmail from "./api/gmail";
import drive, { driveDiagRouter } from "./api/drive";
import chat from "./api/chat";
import memory from "./api/memory";

const app = express();
app.use(express.json());

// Rotte principali (Codex, Drive, Calendar…)
app.use(router);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, service: "zantara-bridge" }));

// Identity (login/me)
app.use(identity);

// Azioni che richiedono API Key authentication
app.use("/actions/gmail", apiKeyGuard, gmail);
app.use("/actions/memory", apiKeyGuard, memory);
app.use("/actions/drive", apiKeyGuard, drive);
app.use("/actions/chat", apiKeyGuard, chat);

// Diagnostica Drive (senza API key; usarla per setup/health)
app.use("/diag/drive", driveDiagRouter);

// Porta
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on", port));

export default app;
