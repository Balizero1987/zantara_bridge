import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Legge il diff del PR
const diff = execSync("git diff origin/main...HEAD", { encoding: "utf-8" });

const prompt = `Sei Codex, AI reviewer. Analizza questo diff e scrivi un commento chiaro e utile come farebbe un senior dev:\n\n${diff}`;

async function run() {
  const resp = await client.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });
  console.log("🤖 Codex Review:\n");
  console.log(resp.content[0].text);
}

run();
