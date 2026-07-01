import { NextResponse } from "next/server";

import type { CashAccount, Transaction, TransactionType } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";

type TransactionRequest = {
  date?: unknown;
  description?: unknown;
  proofNumber?: unknown;
  amount?: unknown;
  type?: unknown;
  account?: unknown;
};

export async function POST(request: Request) {
  await ensureDatabase();

  const payload = (await request.json()) as TransactionRequest;
  const type = payload.type === "kredit" ? "kredit" : "debet";
  const account = payload.account === "tunai" ? "tunai" : "bank";
  const amount = Number(payload.amount);
  const description = String(payload.description ?? "").trim();
  const date = String(payload.date ?? "").slice(0, 10);

  if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Data transaksi belum lengkap." }, { status: 400 });
  }

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    date,
    description,
    proofNumber: String(payload.proofNumber ?? "").trim() || "-",
    amount,
    type: type as TransactionType,
    account: account as CashAccount,
    createdAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO cash_flow_transactions
      (id, date, description, proof_number, amount, type, account, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      transaction.id,
      transaction.date,
      transaction.description,
      transaction.proofNumber,
      transaction.amount,
      transaction.type,
      transaction.account,
      transaction.createdAt,
    ],
  });

  return NextResponse.json(transaction, { status: 201 });
}
