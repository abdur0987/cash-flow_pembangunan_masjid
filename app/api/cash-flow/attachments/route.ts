import { NextResponse } from "next/server";

import type { Attachment } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";

type AttachmentRequest = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
  dataUrl?: unknown;
  notes?: unknown;
  transactionId?: unknown;
};

export async function POST(request: Request) {
  await ensureDatabase();

  const payload = (await request.json()) as AttachmentRequest;
  const name = String(payload.name ?? "").trim();
  const dataUrl = String(payload.dataUrl ?? "");
  const size = Number(payload.size);

  if (!name || !dataUrl || !Number.isFinite(size)) {
    return NextResponse.json({ message: "Data lampiran belum lengkap." }, { status: 400 });
  }

  const attachment: Attachment = {
    id: crypto.randomUUID(),
    name,
    type: String(payload.type ?? "application/octet-stream"),
    size,
    dataUrl,
    notes: String(payload.notes ?? "").trim(),
    transactionId: String(payload.transactionId ?? ""),
    uploadedAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO cash_flow_attachments
      (id, name, type, size, data_url, notes, transaction_id, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      attachment.id,
      attachment.name,
      attachment.type,
      attachment.size,
      attachment.dataUrl,
      attachment.notes,
      attachment.transactionId,
      attachment.uploadedAt,
    ],
  });

  return NextResponse.json(attachment, { status: 201 });
}
