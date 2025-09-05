import express from "express";
import router from "./chatRouter";
const app = express();
app.use(express.json());
app.use(router);
app.get("/health", (_req, res) => res.json({ ok: true }));
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on", port));
export default app;
