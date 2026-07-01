import { NextResponse } from "next/server";

import type { CashAccount, Transaction, TransactionType } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type TransactionRequest = {
  date?: unknown;
  description?: unknown;
  proofNumber?: unknown;
  amount?: unknown;
  type?: unknown;
  account?: unknown;
};

export async function PUT(request: Request, context: RouteContext) {
  await ensureDatabase();

  const { id } = await context.params;
  const payload = (await request.json()) as TransactionRequest;
  const type = payload.type === "kredit" ? "kredit" : "debet";
  const account = payload.account === "tunai" ? "tunai" : "bank";
  const amount = Number(payload.amount);
  const description = String(payload.description ?? "").trim();
  const date = String(payload.date ?? "").slice(0, 10);

  if (!id || !date || !description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Data transaksi belum lengkap." }, { status: 400 });
  }

  const existing = await db.execute({
    sql: "SELECT created_at FROM cash_flow_transactions WHERE id = ?",
    args: [id],
  });

  if (!existing.rows.length) {
    return NextResponse.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  const transaction: Transaction = {
    id,
    date,
    description,
    proofNumber: String(payload.proofNumber ?? "").trim() || "-",
    amount,
    type: type as TransactionType,
    account: account as CashAccount,
    createdAt: String(existing.rows[0].created_at),
  };

  await db.execute({
    sql: `UPDATE cash_flow_transactions
      SET date = ?, description = ?, proof_number = ?, amount = ?, type = ?, account = ?
      WHERE id = ?`,
    args: [
      transaction.date,
      transaction.description,
      transaction.proofNumber,
      transaction.amount,
      transaction.type,
      transaction.account,
      transaction.id,
    ],
  });

  return NextResponse.json(transaction);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await ensureDatabase();

  const { id } = await context.params;
  await db.batch([
    {
      sql: "UPDATE cash_flow_attachments SET transaction_id = '' WHERE transaction_id = ?",
      args: [id],
    },
    {
      sql: "DELETE FROM cash_flow_transactions WHERE id = ?",
      args: [id],
    },
  ]);

  return NextResponse.json({ ok: true });
}
