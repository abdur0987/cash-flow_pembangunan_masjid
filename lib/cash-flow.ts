export type CashAccount = "bank" | "tunai";
export type TransactionType = "debet" | "kredit";
export type LedgerView = "umum" | CashAccount;

export type Transaction = {
  id: string;
  date: string;
  description: string;
  proofNumber: string;
  amount: number;
  type: TransactionType;
  account: CashAccount;
  createdAt: string;
};

export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  notes: string;
  transactionId: string;
  uploadedAt: string;
};

export type TransactionDraft = Omit<Transaction, "id" | "createdAt">;

export const initialTransactions: Transaction[] = [
  tx("seed-001", "2026-06-09", "Transfer Masuk", "BM-001", 115000000, "debet", "bank"),
  tx(
    "seed-002",
    "2026-06-09",
    "Penarikan dari kas bank ke kas tunai",
    "KK-001",
    1250000,
    "kredit",
    "bank",
  ),
  tx("seed-003", "2026-06-09", "Biaya penarikan", "ADM-001", 2500, "kredit", "bank"),
  tx(
    "seed-004",
    "2026-06-09",
    "Penarikan dari kas bank ke kas tunai",
    "KT-001",
    1250000,
    "debet",
    "tunai",
  ),
  tx(
    "seed-005",
    "2026-06-24",
    "Pembuatan bener dan stamole",
    "NT-001",
    1215000,
    "kredit",
    "tunai",
  ),
  tx("seed-006", "2026-06-25", "Setor dari kas tunai ke kas bank", "KT-002", 35000, "kredit", "tunai"),
  tx("seed-007", "2026-06-25", "Setor dari kas tunai ke kas bank", "BM-002", 35000, "debet", "bank"),
  tx(
    "seed-008",
    "2026-06-25",
    "Transfer Masuk dari UPZ Kanwil Kemenag",
    "BM-003",
    100000000,
    "debet",
    "bank",
  ),
  tx("seed-009", "2026-06-30", "TRF dari Kanti Naryati Sukma Sari", "BM-004", 20000, "debet", "bank"),
  tx("seed-010", "2026-06-30", "TRF dari Winardi", "BM-005", 100000, "debet", "bank"),
];

function tx(
  id: string,
  date: string,
  description: string,
  proofNumber: string,
  amount: number,
  type: TransactionType,
  account: CashAccount,
): Transaction {
  return {
    id,
    date,
    description,
    proofNumber,
    amount,
    type,
    account,
    createdAt: `${date}T00:00:00.000Z`,
  };
}
