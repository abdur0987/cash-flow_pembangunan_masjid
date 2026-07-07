import { NextResponse } from "next/server";

import type { Transaction } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";
import { buildCashFlowPdf } from "@/lib/pdf-report";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  await ensureDatabase();

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ message: "Bulan laporan tidak valid." }, { status: 400 });
  }

  const result = await db.execute({
    sql: "SELECT * FROM cash_flow_transactions WHERE date LIKE ? ORDER BY date ASC, created_at ASC",
    args: [`${month}%`],
  });
  const transactions: Transaction[] = (result.rows as unknown as TransactionRow[]).map((item) => ({
    id: item.id,
    date: item.date,
    description: item.description,
    proofNumber: item.proof_number,
    amount: Number(item.amount),
    type: item.type,
    account: item.account,
    createdAt: item.created_at,
  }));
  const pdfBytes = buildCashFlowPdf(month, transactions);

  return new Response(pdfBytes, {
    headers: {
      "Content-Disposition": `attachment; filename="laporan-buku-kas-masjid-${month}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
