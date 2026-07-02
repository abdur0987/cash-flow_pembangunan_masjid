import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import type { CashAccount, Transaction, TransactionType } from "@/lib/cash-flow";
import { db, ensureDatabase } from "@/lib/db";

type ImportedTransaction = Transaction & {
  sourceSheet: string;
};

const ledgerColumns = {
  date: 8,
  description: 9,
  proofNumber: 10,
  debet: 11,
  kredit: 12,
};

export async function POST(request: Request) {
  await ensureDatabase();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File Excel belum dipilih." }, { status: 400 });
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    cellDates: true,
    cellNF: true,
    cellText: true,
  });

  const imported = workbook.SheetNames.flatMap((sheetName) => parseSheet(workbook.Sheets[sheetName], sheetName));

  if (!imported.length) {
    return NextResponse.json({ message: "Tidak ada transaksi yang terbaca dari Excel." }, { status: 400 });
  }

  const months = Array.from(new Set(imported.map((item) => item.date.slice(0, 7)))).sort();
  const cleanupQueries = months.flatMap((month) => [
    {
      sql: `UPDATE cash_flow_attachments
        SET transaction_id = ''
        WHERE transaction_id IN (
          SELECT id FROM cash_flow_transactions WHERE date LIKE ?
        )`,
      args: [`${month}%`],
    },
    {
      sql: "DELETE FROM cash_flow_transactions WHERE date LIKE ?",
      args: [`${month}%`],
    },
  ]);

  await db.batch([
    ...cleanupQueries,
    ...imported.map((item) => ({
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
  ]);

  return NextResponse.json({
    imported: imported.length,
    months,
    sheets: Array.from(new Set(imported.map((item) => item.sourceSheet))),
  });
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  const sheetMonth = getSheetMonth(rows, sheetName);
  const helperHeaders = rows
    .map((row, index) => ({
      index,
      date: normalizeText(row[ledgerColumns.date]),
      description: normalizeText(row[ledgerColumns.description]),
    }))
    .filter((row) => row.date === "TANGGAL" && row.description === "URAIAN");

  const bankHeader = helperHeaders[0]?.index;
  const cashHeader = helperHeaders[1]?.index;

  return [
    ...(bankHeader === undefined ? [] : parseLedger(sheet, rows, sheetName, sheetMonth, bankHeader, "bank")),
    ...(cashHeader === undefined ? [] : parseLedger(sheet, rows, sheetName, sheetMonth, cashHeader, "tunai")),
  ];
}

function parseLedger(
  sheet: XLSX.WorkSheet,
  rows: unknown[][],
  sheetName: string,
  sheetMonth: string,
  headerRow: number,
  account: CashAccount,
) {
  const transactions: ImportedTransaction[] = [];
  let lastDate = "";

  for (let rowIndex = headerRow + 1; rowIndex < Math.min(rows.length, headerRow + 80); rowIndex += 1) {
    const description = getCellText(sheet, rowIndex, ledgerColumns.description);
    if (!description) {
      continue;
    }

    if (/saldo\s+(bank|tunai)\s+akhir/i.test(description)) {
      break;
    }

    const rawDate = normalizeDateToSheetMonth(
      parseExcelDate(getCellText(sheet, rowIndex, ledgerColumns.date)),
      sheetMonth,
    );
    if (rawDate) {
      lastDate = rawDate;
    }

    const date = rawDate || lastDate;
    const debet = parseAmount(getCellText(sheet, rowIndex, ledgerColumns.debet));
    const kredit = parseAmount(getCellText(sheet, rowIndex, ledgerColumns.kredit));
    const type: TransactionType = debet > 0 ? "debet" : "kredit";
    const amount = debet > 0 ? debet : kredit;

    if (!date || amount <= 0) {
      continue;
    }

    const proofNumber = getCellText(sheet, rowIndex, ledgerColumns.proofNumber) || "-";

    transactions.push({
      id: `excel:${slug(sheetName)}:${account}:${rowIndex + 1}`,
      date,
      description,
      proofNumber,
      amount,
      type,
      account,
      createdAt: new Date().toISOString(),
      sourceSheet: sheetName,
    });
  }

  return transactions;
}

function getSheetMonth(rows: unknown[][], sheetName: string) {
  const monthText =
    rows
      .flat()
      .map((value) => normalizeText(value))
      .find((value) => /^BULAN\s+/i.test(value)) ?? sheetName;

  const months: Record<string, string> = {
    januari: "01",
    februari: "02",
    maret: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    agustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    desember: "12",
  };
  const lower = monthText.toLowerCase();
  const monthName = Object.keys(months).find((name) => lower.includes(name));
  const yearMatch = lower.match(/20\d{2}|\b\d{2}\b/);
  const year = yearMatch ? (yearMatch[0].length === 2 ? `20${yearMatch[0]}` : yearMatch[0]) : "";

  return monthName && year ? `${year}-${months[monthName]}` : "";
}

function normalizeDateToSheetMonth(date: string, sheetMonth: string) {
  if (!date || !sheetMonth) {
    return date;
  }

  if (date.startsWith(sheetMonth)) {
    return date;
  }

  return `${sheetMonth}-${date.slice(-2)}`;
}

function parseExcelDate(value: unknown) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) {
    return "";
  }

  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const normalized = normalizeText(value)
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/-/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getCellText(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  return normalizeText(cell?.w ?? cell?.v ?? "");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
