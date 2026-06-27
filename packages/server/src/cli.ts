#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { PassportIssuer } from '@agent-passport/core';
import { createApi } from './api.js';
import { PassportDB } from './db.js';

const port = parseInt(process.env['PORT'] ?? '3100');
const dbPath = process.env['DB_PATH'] ?? 'passport.db';

const issuer = new PassportIssuer();
const db = new PassportDB(dbPath);
const app = createApi(issuer, db);

console.log(`
  ╔══════════════════════════════════════════╗
  ║      Agent Passport Authority Server     ║
  ╠══════════════════════════════════════════╣
  ║  http://localhost:${port}                  ║
  ║  DB: ${dbPath.padEnd(35)}║
  ║  Public Key: ${issuer.publicKey.slice(0, 24)}... ║
  ╚══════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port });
