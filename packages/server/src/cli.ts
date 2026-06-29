#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { PassportIssuer } from '@passport-agent/core';
import { createApi } from './api.js';
import { PassportDB } from './db.js';
import { WebhookManager } from './webhooks.js';
import { ExpiryWatcher } from './expiry-watcher.js';
import { requestLogger } from './logger.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Agent Passport Authority Server

  Usage: agent-passport-server [options]

  Options:
    --port, -p <number>   Port to listen on (default: 3100, env: PORT)
    --db <path>           SQLite database path (default: passport.db, env: DB_PATH)
    --cors                Enable CORS for all origins (default: off)
    --help, -h            Show this help message

  Examples:
    agent-passport-server
    agent-passport-server --port 8080 --db ./data/passports.db
    agent-passport-server --cors
`);
  process.exit(0);
}

function getArg(flag: string, short?: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  if (short) {
    const sIdx = args.indexOf(short);
    if (sIdx !== -1 && args[sIdx + 1]) return args[sIdx + 1];
  }
  return undefined;
}

const port = parseInt(getArg('--port', '-p') ?? process.env['PORT'] ?? '3100');
const dbPath = getArg('--db') ?? process.env['DB_PATH'] ?? 'passport.db';
const enableCors = args.includes('--cors');

const issuer = new PassportIssuer();
const db = new PassportDB(dbPath);
const webhooks = new WebhookManager();
const app = createApi(issuer, db, { cors: enableCors, webhooks, logger: true });

const watcher = new ExpiryWatcher(db, webhooks);
watcher.start();

console.log(`
  ╔══════════════════════════════════════════╗
  ║      Agent Passport Authority Server     ║
  ╠══════════════════════════════════════════╣
  ║  http://localhost:${String(port).padEnd(25)}║
  ║  DB: ${dbPath.padEnd(35)}║
  ║  CORS: ${(enableCors ? 'enabled' : 'disabled').padEnd(33)}║
  ║  Public Key: ${issuer.publicKey.slice(0, 24)}... ║
  ╚══════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port });
