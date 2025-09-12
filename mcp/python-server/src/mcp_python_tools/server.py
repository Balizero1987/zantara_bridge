#!/usr/bin/env python3
"""
Minimal MCP server (Python) con strumenti di base.
Requisiti: `pip install -r requirements.txt` (pacchetto `mcp`).
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Dict, List

# Import MCP (le API possono variare per versione del pacchetto)
from mcp.server import Server
from mcp.server.stdio import stdio_server


DEBUG = (os.environ.get("MCP_DEBUG", "").lower() in {"1", "true", "yes"})


def log_debug(*args):
    if DEBUG:
        print("[DEBUG]", *args, file=os.sys.stderr)


def parse_allowlist_env(name: str) -> List[Path]:
    raw = os.environ.get(name)
    if not raw:
        return []
    items = [p.strip() for p in raw.split(",") if p.strip()]
    return [Path(p).resolve() for p in items]


FS_ALLOW: List[Path] = parse_allowlist_env("MCP_FS_ALLOWLIST")
FETCH_ALLOW_ALL = os.environ.get("MCP_FETCH_ALLOW_ALL", "").lower() in {"1", "true", "yes"}
FETCH_ALLOW_HOSTS = [h.strip() for h in os.environ.get("MCP_FETCH_ALLOW_HOSTS", "").split(",") if h.strip()]


def is_path_allowed(p: Path) -> bool:
    rp = p.resolve()
    if not FS_ALLOW:
        # se non configurato, consenti solo sotto la CWD
        cwd = Path.cwd().resolve()
        try:
            rp.relative_to(cwd)
            return True
        except Exception:
            return rp == cwd
    for root in FS_ALLOW:
        try:
            rp.relative_to(root)
            return True
        except Exception:
            continue
    return False


def ensure_path_allowed(p: Path):
    if not is_path_allowed(p):
        raise ValueError(f"Percorso non consentito: {p}")


def is_host_allowed(host: str) -> bool:
    if FETCH_ALLOW_ALL:
        return True
    if not FETCH_ALLOW_HOSTS:
        return False
    return any(host == h or host.endswith("." + h) for h in FETCH_ALLOW_HOSTS)


server = Server("mcp-python-tools")


def text_response(text: str):
    return [{"type": "text", "text": text}]


@server.tool(
    "health",
    "Verifica lo stato del server",
    {"type": "object", "properties": {}, "additionalProperties": False},
)
async def health():
    return text_response("ok")


@server.tool(
    "echo",
    "Ripete il testo fornito",
    {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "additionalProperties": False,
    },
)
async def echo(text: str):
    return text_response(text)


@server.tool(
    "sum",
    "Somma una lista di numeri",
    {
        "type": "object",
        "properties": {
            "numbers": {"type": "array", "items": {"type": "number"}},
        },
        "required": ["numbers"],
        "additionalProperties": False,
    },
)
async def sum_(numbers: List[float]):
    s = sum(numbers)
    return text_response(str(s))


@server.tool(
    "list_dir",
    "Elenca file/dir in un percorso consentito",
    {
        "type": "object",
        "properties": {"dir": {"type": "string"}},
        "required": ["dir"],
        "additionalProperties": False,
    },
)
async def list_dir(dir: str):
    p = Path(dir)
    ensure_path_allowed(p)
    if not p.exists() or not p.is_dir():
        raise ValueError("Directory non valida")
    out = []
    for e in p.iterdir():
        try:
            st = e.stat()
            out.append({"name": e.name, "isDir": e.is_dir(), "size": st.st_size})
        except Exception:
            out.append({"name": e.name, "isDir": e.is_dir(), "size": None})
    return text_response(json.dumps(out, indent=2))


@server.tool(
    "fs_read",
    "Legge un file (allowlist)",
    {
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "encoding": {"type": "string", "enum": ["utf-8"], "default": "utf-8"},
        },
        "required": ["file"],
        "additionalProperties": False,
    },
)
async def fs_read(file: str, encoding: str = "utf-8"):
    p = Path(file)
    ensure_path_allowed(p)
    data = p.read_text(encoding=encoding)
    max_bytes = 1_000_000
    if len(data) > max_bytes:
        data = data[:max_bytes] + "\n...[troncato]..."
    return text_response(data)


@server.tool(
    "fs_write",
    "Scrive un file (allowlist)",
    {
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": "string"},
            "createDirs": {"type": "boolean", "default": True},
        },
        "required": ["file", "content"],
        "additionalProperties": False,
    },
)
async def fs_write(file: str, content: str, createDirs: bool = True):
    p = Path(file)
    ensure_path_allowed(p)
    if createDirs:
        p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return text_response("ok")


@server.tool(
    "fetch",
    "Esegue richieste HTTP (GET/POST) con allowlist di host",
    {
        "type": "object",
        "properties": {
            "url": {"type": "string"},
            "method": {"type": "string", "enum": ["GET", "POST"], "default": "GET"},
            "headers": {"type": "object", "additionalProperties": {"type": "string"}},
            "body": {"type": "string"},
        },
        "required": ["url"],
        "additionalProperties": False,
    },
)
async def fetch(url: str, method: str = "GET", headers: Dict[str, str] | None = None, body: str | None = None):
    import urllib.request
    import urllib.error
    from urllib.parse import urlparse

    headers = headers or {}
    u = urlparse(url)
    if not is_host_allowed(u.hostname or ""):
        raise ValueError(f"Host non consentito: {u.hostname}")

    data = body.encode("utf-8") if (body is not None and method == "POST") else None
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in headers.items():
        req.add_header(k, v)

    # Timeout 10s
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            # limite 1MB
            if len(raw) > 1_000_000:
                raw = raw[:1_000_000] + b"\n...[troncato]..."
            try:
                text = raw.decode("utf-8", errors="replace")
            except Exception:
                text = str(raw)
            out = {"status": resp.getcode(), "body": text}
            return text_response(json.dumps(out))
    except urllib.error.HTTPError as e:
        raw = e.read() if hasattr(e, 'read') else b""
        msg = raw.decode("utf-8", errors="replace") if raw else str(e)
        out = {"status": e.code, "body": msg}
        return text_response(json.dumps(out))


async def main():
    async with stdio_server() as (reader, writer):
        log_debug("MCP Python server avviato")
        await server.run(reader, writer)


if __name__ == "__main__":
    asyncio.run(main())

