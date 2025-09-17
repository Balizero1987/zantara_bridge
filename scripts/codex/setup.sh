#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/../.." && pwd)
CONFIG_DIR="$HOME/.codex"
CONFIG_FILE="$CONFIG_DIR/config.toml"

echo "==> Ensuring Codex CLI installed (brew or npm)"
if command -v codex >/dev/null 2>&1; then
  echo "Codex already installed"
else
  if command -v brew >/dev/null 2>&1; then
    brew install codex || true
  elif command -v npm >/dev/null 2>&1; then
    npm install -g @openai/codex
  else
    echo "Please install Homebrew or npm first." >&2
    exit 1
  fi
fi

echo "==> Writing repo config to $CONFIG_FILE"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" <<'TOML'
[core]
approvals = "on-request"
sandbox_mode = "workspace-write"
network_access = "enabled"
trace_level = "info"
memory_enabled = true

[ui]
theme = "auto"
show_thinking = true
show_plans = true

[auth]
method = "chatgpt"

[sandbox]
write_whitelist = ["./", "./zantara_bridge/"]
read_whitelist  = ["./", "~"]
blocklist = ["/etc", "/var", "/usr", "/System"]

[plans]
auto_show = true
auto_update = true

[execution]
default_shell = "zsh"
max_output_lines = 256
chunk_read_lines = 250

[tools]
allow_shell = true
allow_apply_patch = true

[mcp_servers.local_docs]
type = "http"
url  = "http://localhost:3001/mcp"
enabled = true
timeout_ms = 8000

[privacy]
zero_data_retention = false
TOML

echo "==> Done. Launching codex (login)"
codex || true

