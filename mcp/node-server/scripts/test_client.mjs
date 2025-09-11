#!/usr/bin/env node
// Minimal MCP client test: spawn our server via stdio and call a few tools.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';

const serverPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../src/server.js'
);

const transport = new StdioClientTransport({
  command: '/usr/local/bin/node',
  args: [serverPath],
  env: {
    MCP_FS_ALLOWLIST: '/Users/antonellosiano/zantara_bridge',
    MCP_FETCH_ALLOW_HOSTS: 'httpbin.org,api.github.com',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
  }
});

const client = new Client({ name: 'mcp-test-client', version: '0.1.0' });

await client.connect(transport);

const tools = await client.listTools();
console.log('# tools');
console.log(JSON.stringify(tools, null, 2));

const health = await client.callTool({ name: 'health', arguments: {} });
console.log('# health');
console.log(JSON.stringify(health, null, 2));

const echo = await client.callTool({ name: 'echo', arguments: { text: 'ciao' } });
console.log('# echo');
console.log(JSON.stringify(echo, null, 2));

// git_status inside allowlisted repo
const git = await client.callTool({ name: 'git_status', arguments: {} });
console.log('# git_status');
console.log(JSON.stringify(git, null, 2));

// fetch httpbin for sanity
const fetchRes = await client.callTool({ name: 'fetch', arguments: { url: 'https://httpbin.org/get' } });
console.log('# fetch httpbin');
console.log(JSON.stringify(fetchRes, null, 2));

if (process.env.GITHUB_TOKEN) {
  const who = await client.callTool({ name: 'github_whoami', arguments: {} });
  console.log('# github_whoami');
  console.log(JSON.stringify(who, null, 2));
} else {
  console.log('# github_whoami');
  console.log('SKIPPED (set GITHUB_TOKEN to test)');
}

process.exit(0);
