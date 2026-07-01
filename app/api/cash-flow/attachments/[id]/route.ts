import { NextResponse } from "next/server";

import type { Attachment } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AttachmentRequest = {
  name?: unknown;
  notes?: unknown;
  transactionId?: unknown;
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

export async function PUT(request: Request, context: RouteContext) {
  await ensureDatabase();

  const { id } = await context.params;
  const payload = (await request.json()) as AttachmentRequest;
  const name = String(payload.name ?? "").trim();

  if (!id || !name) {
    return NextResponse.json({ message: "Data lampiran belum lengkap." }, { status: 400 });
  }

  await db.execute({
    sql: `UPDATE cash_flow_attachments
      SET name = ?, notes = ?, transaction_id = ?
      WHERE id = ?`,
    args: [
      name,
      String(payload.notes ?? "").trim(),
      String(payload.transactionId ?? ""),
      id,
    ],
  });

  const result = await db.execute({
    sql: "SELECT * FROM cash_flow_attachments WHERE id = ?",
    args: [id],
  });

  if (!result.rows.length) {
    return NextResponse.json({ message: "Lampiran tidak ditemukan." }, { status: 404 });
  }

  const item = result.rows[0] as unknown as AttachmentRow;
  const attachment: Attachment = {
    id: item.id,
    name: item.name,
    type: item.type,
    size: Number(item.size),
    dataUrl: item.data_url,
    notes: item.notes,
    transactionId: item.transaction_id,
    uploadedAt: item.uploaded_at,
  };

  return NextResponse.json(attachment);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await ensureDatabase();

  const { id } = await context.params;
  await db.execute({
    sql: "DELETE FROM cash_flow_attachments WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ ok: true });
}
