import http from 'node:http';
import mongoose from 'mongoose';
import { env, assertEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import './models/index.js';
import { createApp } from './app.js';
import { initRealtime, closeRealtime } from './services/realtime.js';
import { logger } from './utils/logger.js';

async function main() {
  assertEnv();
  await connectDb();
  // Make sure every unique index exists BEFORE accepting orders. They are what prevent duplicates.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const server = http.createServer(createApp());
  initRealtime(server);
  server.listen(env.port, () => logger.info(`API listening on port ${env.port}`, { env: env.nodeEnv }));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    closeRealtime();
    server.close(async () => { await disconnectDb(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => { logger.error('Failed to start', { error: err.message }); process.exit(1); });
process.on('unhandledRejection', (err) => logger.error('unhandledRejection', { error: String(err?.message || err) }));
