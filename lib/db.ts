import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { initialTransactions } from "@/lib/cash-flow";

const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const databaseUrl = tursoDatabaseUrl || `file:${path.join(process.cwd(), "data", "cash-flow.sqlite")}`;

if (databaseUrl.startsWith("file:")) {
  mkdirSync(path.dirname(databaseUrl.replace("file:", "")), { recursive: true });
}

export const databaseDriver = tursoDatabaseUrl ? "turso" : "local-libsql";

export const db = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initialized = false;

export async function ensureDatabase() {
  if (initialized) {
    return;
  }

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS cash_flow_transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        proof_number TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('debet', 'kredit')),
        account TEXT NOT NULL CHECK (account IN ('bank', 'tunai')),
        created_at TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS cash_flow_attachments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        data_url TEXT NOT NULL,
        notes TEXT NOT NULL,
        transaction_id TEXT NOT NULL DEFAULT '',
        uploaded_at TEXT NOT NULL
      )`,
      args: [],
    },
  ]);

  const count = await db.execute("SELECT COUNT(*) as total FROM cash_flow_transactions");
  const total = Number(count.rows[0]?.total ?? 0);

  if (total === 0) {
    await db.batch(
      initialTransactions.map((item) => ({
        sql: `INSERT INTO cash_flow_transactions
          (id, date, description, proof_number, amount, type, account, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          item.date,
          item.description,
          item.proofNumber,
          item.amount,
          item.type,
          item.account,
          item.createdAt,
        ],
      })),
    );
  }

  initialized = true;
}
