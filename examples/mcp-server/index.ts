import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PassportIssuer } from '@passport-agent/core';
import { passportGuard } from '@passport-agent/mcp';

// 1. Create your MCP server as usual
const server = new McpServer({
  name: 'demo-server',
  version: '1.0.0',
});

// 2. Add passport protection — one line
const issuer = new PassportIssuer();
passportGuard(server, {
  issuer,
  onDenied: (tool, result) => console.error(`BLOCKED ${tool}: ${result.reason}`),
  onAllowed: (tool) => console.error(`ALLOWED ${tool}`),
});

// 3. Register tools normally — they're now passport-protected
server.tool('read_file', 'Read a file from disk', async (extra) => {
  return { content: [{ type: 'text', text: 'File contents here...' }] };
});

server.tool('delete_file', 'Delete a file from disk', async (extra) => {
  return { content: [{ type: 'text', text: 'Deleted.' }] };
});

// Every tool call now requires a valid passport token in _meta['x-passport'].
// Without it → denied. Wrong permissions → denied. Expired → denied.
const transport = new StdioServerTransport();
await server.connect(transport);
