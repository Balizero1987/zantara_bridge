#!/usr/bin/env node
const { execSync } = require("child_process");
function run(cmd){ try{ return execSync(cmd, { encoding:"utf8" }).trim(); } catch{ return "(n/a)"; } }
const branch = process.env.GITHUB_REF_NAME || run("git rev-parse --abbrev-ref HEAD");
const commit = process.env.GITHUB_SHA || run("git rev-parse HEAD");
const author = run("git log -1 --pretty=format:'%an <%ae>'");
console.log("✅ Codex review placeholder - running extended log");
console.log("🔹 Branch:", branch);
console.log("🔹 Commit:", commit);
console.log("🔹 Author:", author);
process.exit(0);

