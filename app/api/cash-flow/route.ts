import { NextResponse } from "next/server";

import type { Attachment, Transaction } from "@/lib/cash-flow";
import { databaseDriver, db, ensureDatabase } from "@/lib/db";

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  proof_number: string;
  amount: number;
  type: "debet" | "kredit";
  account: "bank" | "tunai";
  created_at: string;
};

type AttachmentRow = {
  id: string;
  name: string;
  type: string;
  size: number;
  data_url: string;
  notes: string;
  transaction_id: string;
  uploaded_at: string;
};

export async function GET() {
  await ensureDatabase();

  const [transactionsResult, attachmentsResult] = await Promise.all([
    db.execute("SELECT * FROM cash_flow_transactions ORDER BY date ASC, created_at ASC"),
    db.execute("SELECT * FROM cash_flow_attachments ORDER BY uploaded_at DESC"),
  ]);

  const transactions: Transaction[] = (transactionsResult.rows as unknown as TransactionRow[]).map((item) => ({
    id: item.id,
    date: item.date,
    description: item.description,
    proofNumber: item.proof_number,
    amount: Number(item.amount),
    type: item.type,
    account: item.account,
    createdAt: item.created_at,
  }));

  const attachments: Attachment[] = (attachmentsResult.rows as unknown as AttachmentRow[]).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    size: Number(item.size),
    dataUrl: item.data_url,
    notes: item.notes,
    transactionId: item.transaction_id,
    uploadedAt: item.uploaded_at,
  }));

  return NextResponse.json({
    attachments,
    databaseDriver,
    transactions,
  });
}
