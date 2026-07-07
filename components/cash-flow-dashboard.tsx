"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  BarChart3,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactElement, ReactNode } from "react";

import type {
  Attachment,
  CashAccount,
  LedgerView,
  Transaction,
  TransactionDraft,
  TransactionType,
} from "@/lib/cash-flow";
import { initialTransactions } from "@/lib/cash-flow";

type MainTab = "dashboard" | "transactions" | "attachments";
type TransactionView = LedgerView | "laporan";
type AttachmentDraft = Pick<Attachment, "name" | "notes" | "transactionId">;
type AttachmentMap = Record<string, Attachment[]>;

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const emptyDraft: TransactionDraft = {
  date: "2026-06-30",
  description: "",
  proofNumber: "",
  amount: 0,
  type: "debet",
  account: "bank",
};

function formatCurrency(value: number) {
  return `Rp ${formatNumber(value)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function getLedgerRows(transactions: Transaction[], view: LedgerView) {
  let runningBalance = 0;

  return transactions
    .filter((item) => view === "umum" || item.account === view)
    .map((item) => {
      runningBalance += item.type === "debet" ? item.amount : -item.amount;
      return {
        ...item,
        debet: item.type === "debet" ? item.amount : 0,
        kredit: item.type === "kredit" ? item.amount : 0,
        saldo: runningBalance,
      };
    });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type CashFlowResponse = {
  attachments: Attachment[];
  databaseDriver: string;
  transactions: Transaction[];
};

export function CashFlowDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draft, setDraft] = useState<TransactionDraft>(emptyDraft);
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>({
    name: "",
    notes: "",
    transactionId: "",
  });
  const [activeMonth, setActiveMonth] = useState("2026-06");
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [ledgerView, setLedgerView] = useState<LedgerView>("umum");
  const [transactionView, setTransactionView] = useState<TransactionView>("umum");
  const [uploadTransactionId, setUploadTransactionId] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [query, setQuery] = useState("");
  const [databaseDriver, setDatabaseDriver] = useState("loading");
  const [statusMessage, setStatusMessage] = useState("Menghubungkan database...");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [editingAttachmentId, setEditingAttachmentId] = useState("");
  const [proofPreview, setProofPreview] = useState<{
    attachments: Attachment[];
    transaction: Transaction;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setStatusMessage("Menghubungkan database...");
    const response = await fetch("/api/cash-flow");
    if (!response.ok) {
      setDatabaseDriver("offline");
      setStatusMessage("Database belum bisa dimuat. Menampilkan data contoh sementara.");
      return;
    }

    const data = (await response.json()) as CashFlowResponse;
    setTransactions(data.transactions.length ? data.transactions : initialTransactions);
    setAttachments(data.attachments);
    setDatabaseDriver(data.databaseDriver);
    setStatusMessage(
      data.databaseDriver === "turso"
        ? "Tersambung ke Turso online"
        : "Tersambung ke database lokal libSQL",
    );
  }

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => {
        const dateSort = a.date.localeCompare(b.date);
        return dateSort || a.createdAt.localeCompare(b.createdAt);
      }),
    [transactions],
  );

  const monthOptions = useMemo(
    () => Array.from(new Set(sortedTransactions.map((item) => getMonthKey(item.date)))).sort(),
    [sortedTransactions],
  );

  const monthlyTransactions = useMemo(
    () => sortedTransactions.filter((item) => getMonthKey(item.date) === activeMonth),
    [activeMonth, sortedTransactions],
  );

  const ledgerRows = useMemo(
    () => getLedgerRows(monthlyTransactions, ledgerView),
    [ledgerView, monthlyTransactions],
  );

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return ledgerRows;
    }

    return ledgerRows.filter((item) =>
      [item.description, item.proofNumber, item.account, item.type]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [ledgerRows, query]);

  const summary = useMemo(() => {
    const debet = monthlyTransactions
      .filter((item) => item.type === "debet")
      .reduce((total, item) => total + item.amount, 0);
    const kredit = monthlyTransactions
      .filter((item) => item.type === "kredit")
      .reduce((total, item) => total + item.amount, 0);
    const bank = monthlyTransactions.reduce((total, item) => {
      if (item.account !== "bank") {
        return total;
      }
      return total + (item.type === "debet" ? item.amount : -item.amount);
    }, 0);
    const tunai = monthlyTransactions.reduce((total, item) => {
      if (item.account !== "tunai") {
        return total;
      }
      return total + (item.type === "debet" ? item.amount : -item.amount);
    }, 0);

    return {
      debet,
      kredit,
      saldo: debet - kredit,
      bank,
      tunai,
    };
  }, [monthlyTransactions]);

  const monthlyChart = useMemo(() => {
    return monthOptions.map((monthKey) => {
      const rows = sortedTransactions.filter((item) => getMonthKey(item.date) === monthKey);
      const debet = rows
        .filter((item) => item.type === "debet")
        .reduce((total, item) => total + item.amount, 0);
      const kredit = rows
        .filter((item) => item.type === "kredit")
        .reduce((total, item) => total + item.amount, 0);

      return {
        bulan: getMonthLabel(monthKey).replace(" 2026", ""),
        pemasukan: debet,
        pengeluaran: kredit,
        saldo: debet - kredit,
      };
    });
  }, [monthOptions, sortedTransactions]);

  const selectedMonthAttachments = useMemo(() => {
    const monthlyIds = new Set(monthlyTransactions.map((item) => item.id));
    return attachments.filter((item) => {
      if (item.transactionId) {
        return monthlyIds.has(item.transactionId);
      }
      return getMonthKey(item.uploadedAt.slice(0, 10)) === activeMonth;
    });
  }, [activeMonth, attachments, monthlyTransactions]);

  const attachmentMap = useMemo(
    () =>
      attachments.reduce<AttachmentMap>((grouped, attachment) => {
        if (!attachment.transactionId) {
          return grouped;
        }

        grouped[attachment.transactionId] = [...(grouped[attachment.transactionId] ?? []), attachment];
        return grouped;
      }, {}),
    [attachments],
  );

  const transactionTotals = useMemo(() => {
    const filteredRows = monthlyTransactions.filter(
      (item) => ledgerView === "umum" || item.account === ledgerView,
    );
    return {
      debet: filteredRows
        .filter((item) => item.type === "debet")
        .reduce((total, item) => total + item.amount, 0),
      kredit: filteredRows
        .filter((item) => item.type === "kredit")
        .reduce((total, item) => total + item.amount, 0),
      saldo: ledgerRows.at(-1)?.saldo ?? 0,
    };
  }, [ledgerRows, ledgerView, monthlyTransactions]);

  const transactionViewRows = useMemo(() => {
    if (transactionView === "laporan") {
      return monthlyTransactions;
    }

    return monthlyTransactions.filter((item) => transactionView === "umum" || item.account === transactionView);
  }, [monthlyTransactions, transactionView]);

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.description.trim() || draft.amount <= 0) {
      return;
    }

    setIsSaving(true);
    const url = editingTransactionId
      ? `/api/cash-flow/transactions/${editingTransactionId}`
      : "/api/cash-flow/transactions";
    const response = await fetch(url, {
      method: editingTransactionId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setIsSaving(false);

    if (!response.ok) {
      setStatusMessage("Transaksi gagal disimpan ke database.");
      return;
    }

    const saved = (await response.json()) as Transaction;
    setTransactions((current) =>
      editingTransactionId
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved],
    );
    setActiveMonth(getMonthKey(saved.date));
    setDraft({ ...emptyDraft, date: saved.date });
    setEditingTransactionId("");
    setStatusMessage(editingTransactionId ? "Transaksi berhasil diperbarui." : "Transaksi tersimpan ke database.");
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsImporting(true);
    const response = await fetch("/api/cash-flow/import", {
      method: "POST",
      body: formData,
    });
    setIsImporting(false);
    event.target.value = "";

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setStatusMessage(data?.message ?? "Import Excel gagal.");
      return;
    }

    const data = (await response.json()) as { imported: number; months: string[]; sheets: string[] };
    if (data.months.length) {
      setActiveMonth(data.months.at(-1) ?? activeMonth);
    }
    await loadData();
    setStatusMessage(`Import Excel berhasil: ${data.imported} baris dari ${data.sheets.length} sheet.`);
  }

  function startEditTransaction(transaction: Transaction) {
    setDraft({
      date: transaction.date,
      description: transaction.description,
      proofNumber: transaction.proofNumber,
      amount: transaction.amount,
      type: transaction.type,
      account: transaction.account,
    });
    setEditingTransactionId(transaction.id);
    setActiveTab("transactions");
  }

  function cancelEditTransaction() {
    setEditingTransactionId("");
    setDraft(emptyDraft);
  }

  async function deleteTransaction(id: string) {
    const confirmed = window.confirm("Hapus transaksi ini? Lampiran terkait akan dilepas dari transaksi.");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/cash-flow/transactions/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatusMessage("Transaksi gagal dihapus.");
      return;
    }

    setTransactions((current) => current.filter((item) => item.id !== id));
    setAttachments((current) =>
      current.map((item) => (item.transactionId === id ? { ...item, transactionId: "" } : item)),
    );
    setStatusMessage("Transaksi berhasil dihapus.");
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setIsUploading(true);
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const response = await fetch("/api/cash-flow/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl: await readFileAsDataUrl(file),
            notes: uploadNotes,
            transactionId: uploadTransactionId,
          }),
        });

        if (!response.ok) {
          throw new Error("Lampiran gagal disimpan.");
        }

        return (await response.json()) as Attachment;
      }),
    ).catch(() => null);

    setIsUploading(false);

    if (!uploaded) {
      setStatusMessage("Lampiran gagal disimpan ke database.");
      event.target.value = "";
      return;
    }

    setAttachments((current) => [...uploaded, ...current]);
    setUploadNotes("");
    setStatusMessage("Lampiran tersimpan ke database.");
    event.target.value = "";
  }

  function startEditAttachment(attachment: Attachment) {
    setEditingAttachmentId(attachment.id);
    setAttachmentDraft({
      name: attachment.name,
      notes: attachment.notes,
      transactionId: attachment.transactionId,
    });
    setActiveTab("attachments");
  }

  function cancelEditAttachment() {
    setEditingAttachmentId("");
    setAttachmentDraft({ name: "", notes: "", transactionId: "" });
  }

  async function saveAttachmentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAttachmentId || !attachmentDraft.name.trim()) {
      return;
    }

    const response = await fetch(`/api/cash-flow/attachments/${editingAttachmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attachmentDraft),
    });

    if (!response.ok) {
      setStatusMessage("Lampiran gagal diperbarui.");
      return;
    }

    const saved = (await response.json()) as Attachment;
    setAttachments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    cancelEditAttachment();
    setStatusMessage("Lampiran berhasil diperbarui.");
  }

  async function deleteAttachment(id: string) {
    const confirmed = window.confirm("Hapus lampiran ini dari database?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/cash-flow/attachments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatusMessage("Lampiran gagal dihapus.");
      return;
    }

    setAttachments((current) => current.filter((item) => item.id !== id));
    setStatusMessage("Lampiran berhasil dihapus.");
  }

  function openProofPreview(transaction: Transaction) {
    const transactionAttachments = attachmentMap[transaction.id] ?? [];
    if (!transactionAttachments.length) {
      return;
    }

    setProofPreview({
      attachments: transactionAttachments,
      transaction,
    });
  }

  function refreshData() {
    loadData();
    setLedgerView("umum");
    setQuery("");
  }

  return (
    <main className="min-h-screen">
      <section className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-mosque-green text-white shadow-soft">
                <Landmark aria-hidden="true" className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-mosque-gold">
                  Kanwil Kementerian Agama Provinsi Lampung
                </p>
                <h1 className="mt-1 text-2xl font-bold text-mosque-ink sm:text-3xl">
                  Cash Flow Pembangunan Masjid Babul Jannah
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Monitoring pemasukan, pengeluaran, saldo kas bank dan kas tunai,
                  lampiran nota pembelian, serta laporan bulanan siap unduh PDF.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded bg-mosque-mint px-2.5 py-1 text-mosque-green">
                    DB: {databaseDriver}
                  </span>
                  <span className="rounded bg-slate-100 px-2.5 py-1 text-slate-600">{statusMessage}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={activeMonth}
                onChange={(event) => setActiveMonth(event.target.value)}
                className="h-11 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-mosque-ink outline-none transition focus:border-mosque-green focus:ring-2 focus:ring-mosque-green/20"
                aria-label="Pilih bulan laporan"
              >
                {monthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {getMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
              <a
                href={`/api/cash-flow/report?month=${activeMonth}`}
                download={`laporan-buku-kas-masjid-${activeMonth}.pdf`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded bg-mosque-green px-4 text-sm font-bold text-white transition hover:bg-mosque-ink"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download PDF
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Banknote aria-hidden="true" className="h-5 w-5" />}
              label="Total Pemasukan"
              value={formatCurrency(summary.debet)}
              tone="green"
            />
            <MetricCard
              icon={<ReceiptText aria-hidden="true" className="h-5 w-5" />}
              label="Total Pengeluaran"
              value={formatCurrency(summary.kredit)}
              tone="gold"
            />
            <MetricCard
              icon={<WalletCards aria-hidden="true" className="h-5 w-5" />}
              label="Saldo Akhir"
              value={formatCurrency(summary.saldo)}
              tone="sky"
            />
            <MetricCard
              icon={<FileText aria-hidden="true" className="h-5 w-5" />}
              label="Lampiran Bulan Ini"
              value={`${selectedMonthAttachments.length} file`}
              tone="slate"
            />
          </div>

          <nav className="no-print grid gap-2 rounded border border-slate-200 bg-slate-50 p-1 sm:grid-cols-3">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
              <BarChart3 aria-hidden="true" className="h-4 w-4" />
              Dashboard
            </TabButton>
            <TabButton active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")}>
              <ReceiptText aria-hidden="true" className="h-4 w-4" />
              Transaksi
            </TabButton>
            <TabButton active={activeTab === "attachments"} onClick={() => setActiveTab("attachments")}>
              <FileText aria-hidden="true" className="h-4 w-4" />
              Daftar Bukti
            </TabButton>
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {activeTab === "dashboard" ? (
          <DashboardTab
            attachmentMap={attachmentMap}
            ledgerRows={visibleTransactions}
            ledgerView={ledgerView}
            monthlyChart={monthlyChart}
            monthLabel={getMonthLabel(activeMonth)}
            onOpenProofs={openProofPreview}
            query={query}
            setLedgerView={setLedgerView}
            setQuery={setQuery}
            transactionTotals={transactionTotals}
          />
        ) : null}

        {activeTab === "transactions" ? (
          <TransactionsTab
            activeMonthLabel={getMonthLabel(activeMonth)}
            attachmentMap={attachmentMap}
            draft={draft}
            editingTransactionId={editingTransactionId}
            isImporting={isImporting}
            isSaving={isSaving}
            monthlyTransactions={transactionViewRows}
            onImportExcel={importExcel}
            onCancelEdit={cancelEditTransaction}
            onDelete={deleteTransaction}
            onEdit={startEditTransaction}
            onOpenProofs={openProofPreview}
            onSubmit={saveTransaction}
            setDraft={setDraft}
            setTransactionView={setTransactionView}
            summary={summary}
            transactionView={transactionView}
          />
        ) : null}

        {activeTab === "attachments" ? (
          <AttachmentsTab
            attachmentDraft={attachmentDraft}
            editingAttachmentId={editingAttachmentId}
            isUploading={isUploading}
            monthlyAttachments={selectedMonthAttachments}
            monthlyTransactions={monthlyTransactions}
            onCancelEdit={cancelEditAttachment}
            onDelete={deleteAttachment}
            onEdit={startEditAttachment}
            onRefresh={refreshData}
            onSaveEdit={saveAttachmentEdit}
            setAttachmentDraft={setAttachmentDraft}
            setUploadNotes={setUploadNotes}
            setUploadTransactionId={setUploadTransactionId}
            transactions={transactions}
            uploadFiles={uploadFiles}
            uploadNotes={uploadNotes}
            uploadTransactionId={uploadTransactionId}
          />
        ) : null}
      </div>
      {proofPreview ? (
        <ProofPreviewModal
          attachments={proofPreview.attachments}
          onClose={() => setProofPreview(null)}
          transaction={proofPreview.transaction}
        />
      ) : null}
    </main>
  );
}

function DashboardTab({
  attachmentMap,
  ledgerRows,
  ledgerView,
  monthlyChart,
  monthLabel,
  onOpenProofs,
  query,
  setLedgerView,
  setQuery,
  transactionTotals,
}: {
  attachmentMap: AttachmentMap;
  ledgerRows: ReturnType<typeof getLedgerRows>;
  ledgerView: LedgerView;
  monthlyChart: { bulan: string; pemasukan: number; pengeluaran: number; saldo: number }[];
  monthLabel: string;
  onOpenProofs: (transaction: Transaction) => void;
  query: string;
  setLedgerView: (view: LedgerView) => void;
  setQuery: (value: string) => void;
  transactionTotals: { debet: number; kredit: number; saldo: number };
}) {
  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel icon={<BarChart3 aria-hidden="true" className="h-5 w-5 text-mosque-sky" />} kicker="Grafik Bulanan" title="Pemasukan dan Pengeluaran">
          <BarChart data={monthlyChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bulan" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000000} jt`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="pemasukan" fill="#2f6f4e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pengeluaran" fill="#c58b22" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
        <ChartPanel icon={<FileSpreadsheet aria-hidden="true" className="h-5 w-5 text-mosque-sky" />} kicker="Tren Saldo" title="Akumulasi Cash Flow">
          <LineChart data={monthlyChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bulan" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000000} jt`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Line type="monotone" dataKey="saldo" stroke="#2f7f9f" strokeWidth={3} dot={{ r: 4, fill: "#2f7f9f" }} />
          </LineChart>
        </ChartPanel>
      </div>

      <div className="rounded border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-mosque-gold">Buku Kas {monthLabel}</p>
            <h2 className="text-lg font-bold text-mosque-ink">
              {ledgerView === "umum" ? "Buku Kas Umum" : ledgerView === "bank" ? "Buku Kas Bank" : "Buku Kas Tunai"}
            </h2>
          </div>
          <LedgerControls ledgerView={ledgerView} query={query} setLedgerView={setLedgerView} setQuery={setQuery} />
        </div>
        <LedgerTable
          attachmentMap={attachmentMap}
          onOpenProofs={onOpenProofs}
          rows={ledgerRows}
          totals={transactionTotals}
        />
      </div>
    </section>
  );
}

function TransactionsTab({
  activeMonthLabel,
  attachmentMap,
  draft,
  editingTransactionId,
  isImporting,
  isSaving,
  monthlyTransactions,
  onImportExcel,
  onCancelEdit,
  onDelete,
  onEdit,
  onOpenProofs,
  onSubmit,
  setDraft,
  setTransactionView,
  summary,
  transactionView,
}: {
  activeMonthLabel: string;
  attachmentMap: AttachmentMap;
  draft: TransactionDraft;
  editingTransactionId: string;
  isImporting: boolean;
  isSaving: boolean;
  monthlyTransactions: Transaction[];
  onImportExcel: (event: ChangeEvent<HTMLInputElement>) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onOpenProofs: (transaction: Transaction) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setDraft: (updater: (current: TransactionDraft) => TransactionDraft) => void;
  setTransactionView: (view: TransactionView) => void;
  summary: { debet: number; kredit: number; saldo: number; bank: number; tunai: number };
  transactionView: TransactionView;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={onSubmit} className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <PanelTitle
          icon={<Plus aria-hidden="true" className="h-5 w-5" />}
          kicker="Input Data"
          title={editingTransactionId ? "Edit Transaksi" : "Tambah Transaksi"}
        />
        <div className="space-y-3">
          <Field label="Tanggal">
            <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} className="field" required />
          </Field>
          <Field label="Uraian">
            <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="field min-h-20 resize-y" placeholder="Contoh: Pembelian semen 20 sak" required />
          </Field>
          <Field label="No Bukti">
            <input value={draft.proofNumber} onChange={(event) => setDraft((current) => ({ ...current, proofNumber: event.target.value }))} className="field" placeholder="NT-006" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis">
              <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as TransactionType }))} className="field">
                <option value="debet">Debet</option>
                <option value="kredit">Kredit</option>
              </select>
            </Field>
            <Field label="Kas">
              <select value={draft.account} onChange={(event) => setDraft((current) => ({ ...current, account: event.target.value as CashAccount }))} className="field">
                <option value="bank">Bank</option>
                <option value="tunai">Tunai</option>
              </select>
            </Field>
          </div>
          <Field label="Nominal">
            <input type="number" min="0" value={draft.amount || ""} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) }))} className="field" placeholder="0" required />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded bg-mosque-ink px-4 text-sm font-bold text-white transition hover:bg-mosque-green">
              <Save aria-hidden="true" className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : editingTransactionId ? "Simpan Edit" : "Simpan Transaksi"}
            </button>
            {editingTransactionId ? (
              <button type="button" onClick={onCancelEdit} className="inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-mosque-green hover:text-mosque-green">
                <X aria-hidden="true" className="h-4 w-4" />
                Batal
              </button>
            ) : null}
          </div>
          <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded border border-mosque-green bg-mosque-mint px-4 text-sm font-bold text-mosque-green transition hover:bg-white">
            <Upload aria-hidden="true" className="h-4 w-4" />
            {isImporting ? "Mengimport Excel..." : "Upload Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={onImportExcel} className="sr-only" />
          </label>
        </div>
      </form>

      <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <PanelTitle icon={<ReceiptText aria-hidden="true" className="h-5 w-5" />} kicker="Data Bulanan" title="Edit dan Hapus Transaksi" compact />
          <BookViewTabs current={transactionView} onChange={setTransactionView} />
        </div>

        {transactionView === "laporan" ? (
          <FinancialReport monthLabel={activeMonthLabel} summary={summary} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-3">Tanggal</th>
                  <th className="px-3 py-3">Uraian</th>
                  <th className="px-3 py-3">No Bukti</th>
                  <th className="px-3 py-3">Bukti</th>
                  <th className="px-3 py-3 text-right">Nominal</th>
                  <th className="px-3 py-3">Jenis</th>
                  <th className="py-3 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTransactions.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3 font-medium text-mosque-ink">{formatDate(item.date)}</td>
                    <td className="px-3 py-3 text-slate-700">{item.description}</td>
                    <td className="px-3 py-3 text-slate-600">{item.proofNumber}</td>
                    <td className="px-3 py-3">
                      <ProofButton
                        attachments={attachmentMap[item.id] ?? []}
                        onClick={() => onOpenProofs(item)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-mosque-ink">{formatCurrency(item.amount)}</td>
                    <td className="px-3 py-3 text-slate-600">{item.type} / {item.account}</td>
                    <td className="py-3 pl-3">
                      <ActionButtons onDelete={() => onDelete(item.id)} onEdit={() => onEdit(item)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function AttachmentsTab({
  attachmentDraft,
  editingAttachmentId,
  isUploading,
  monthlyAttachments,
  monthlyTransactions,
  onCancelEdit,
  onDelete,
  onEdit,
  onRefresh,
  onSaveEdit,
  setAttachmentDraft,
  setUploadNotes,
  setUploadTransactionId,
  transactions,
  uploadFiles,
  uploadNotes,
  uploadTransactionId,
}: {
  attachmentDraft: AttachmentDraft;
  editingAttachmentId: string;
  isUploading: boolean;
  monthlyAttachments: Attachment[];
  monthlyTransactions: Transaction[];
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEdit: (attachment: Attachment) => void;
  onRefresh: () => void;
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  setAttachmentDraft: (updater: (current: AttachmentDraft) => AttachmentDraft) => void;
  setUploadNotes: (value: string) => void;
  setUploadTransactionId: (value: string) => void;
  transactions: Transaction[];
  uploadFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  uploadNotes: string;
  uploadTransactionId: string;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
          <PanelTitle icon={<Upload aria-hidden="true" className="h-5 w-5" />} kicker="Lampiran" title="Upload Nota atau Dokumen" />
          <div className="space-y-3">
            <Field label="Kaitkan ke Transaksi">
              <select value={uploadTransactionId} onChange={(event) => setUploadTransactionId(event.target.value)} className="field">
                <option value="">Tidak dikaitkan</option>
                {monthlyTransactions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDate(item.date)} - {item.description}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Catatan Lampiran">
              <input value={uploadNotes} onChange={(event) => setUploadNotes(event.target.value)} className="field" placeholder="Contoh: Nota pembelian material" />
            </Field>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-mosque-green/50 bg-mosque-mint/60 px-4 py-5 text-center text-sm text-mosque-ink transition hover:border-mosque-green hover:bg-mosque-mint">
              <Upload aria-hidden="true" className="h-6 w-6 text-mosque-green" />
              <span className="font-bold">Pilih file nota, foto, PDF, Word, atau Excel</span>
              <span className="text-xs text-slate-600">{isUploading ? "Menyimpan lampiran..." : "File tersimpan di database libSQL/Turso"}</span>
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={uploadFiles} className="sr-only" />
            </label>
          </div>
        </div>

        {editingAttachmentId ? (
          <form onSubmit={onSaveEdit} className="rounded border border-slate-200 bg-white p-4 shadow-soft">
            <PanelTitle icon={<Edit3 aria-hidden="true" className="h-5 w-5" />} kicker="Edit Bukti" title="Perbarui Lampiran" />
            <div className="space-y-3">
              <Field label="Nama File">
                <input value={attachmentDraft.name} onChange={(event) => setAttachmentDraft((current) => ({ ...current, name: event.target.value }))} className="field" required />
              </Field>
              <Field label="Kaitkan ke Transaksi">
                <select value={attachmentDraft.transactionId} onChange={(event) => setAttachmentDraft((current) => ({ ...current, transactionId: event.target.value }))} className="field">
                  <option value="">Tidak dikaitkan</option>
                  {monthlyTransactions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDate(item.date)} - {item.description}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Catatan">
                <input value={attachmentDraft.notes} onChange={(event) => setAttachmentDraft((current) => ({ ...current, notes: event.target.value }))} className="field" />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded bg-mosque-ink px-4 text-sm font-bold text-white transition hover:bg-mosque-green">
                  <Save aria-hidden="true" className="h-4 w-4" />
                  Simpan Edit
                </button>
                <button type="button" onClick={onCancelEdit} className="inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-mosque-green hover:text-mosque-green">
                  <X aria-hidden="true" className="h-4 w-4" />
                  Batal
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <PanelTitle icon={<FileText aria-hidden="true" className="h-5 w-5" />} kicker="Daftar Bukti" title="Lampiran Bulanan" compact />
          <button type="button" onClick={onRefresh} className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 transition hover:border-mosque-green hover:text-mosque-green" title="Muat ulang data" aria-label="Muat ulang data">
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {monthlyAttachments.length ? (
            monthlyAttachments.map((item) => {
              const transaction = transactions.find((row) => row.id === item.transactionId);
              return (
                <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white text-mosque-green">
                      <FileText aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-mosque-ink">{item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {transaction?.description ?? "Belum dikaitkan"} - {Math.round(item.size / 1024)} KB
                      </p>
                      {item.notes ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.notes}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={item.dataUrl} download={item.name} className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs font-bold text-mosque-sky hover:text-mosque-ink">
                          <Download aria-hidden="true" className="h-3.5 w-3.5" />
                          Unduh
                        </a>
                        <ActionButtons onDelete={() => onDelete(item.id)} onEdit={() => onEdit(item)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600 xl:col-span-2">
              Belum ada lampiran untuk bulan ini.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BookViewTabs({
  current,
  onChange,
}: {
  current: TransactionView;
  onChange: (view: TransactionView) => void;
}) {
  const tabs: Array<[TransactionView, string]> = [
    ["umum", "Buku Kas Umum"],
    ["bank", "Buku Pembantu Kas Bank"],
    ["tunai", "Buku Pembantu Kas Tunai"],
    ["laporan", "Laporan Keuangan Masjid"],
  ];

  return (
    <div className="grid gap-1 rounded border border-slate-200 bg-slate-50 p-1 sm:grid-cols-2 xl:grid-cols-4">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`h-9 rounded px-3 text-xs font-bold transition ${
            current === value ? "bg-white text-mosque-green shadow-sm" : "text-slate-600 hover:text-mosque-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FinancialReport({
  monthLabel,
  summary,
}: {
  monthLabel: string;
  summary: { debet: number; kredit: number; saldo: number; bank: number; tunai: number };
}) {
  return (
    <div className="max-w-3xl rounded border border-slate-300 bg-white">
      <div className="border-b border-slate-300 bg-mosque-leaf px-4 py-4 text-center font-bold text-mosque-ink">
        <p>LAPORAN KEUANGAN MASJID</p>
        <p>MASJID &quot;BAITUL JANNAH&quot;</p>
        <p>KANWIL KEMENTERIAN AGAMA PROVINSI LAMPUNG</p>
        <p>BULAN {monthLabel.toUpperCase()}</p>
      </div>
      <div className="space-y-5 p-5 text-sm">
        <div>
          <p className="mb-2 font-bold text-mosque-ink">Pemasukan</p>
          <ReportLine label="Kas Bendahara" value={summary.tunai} />
          <ReportLine label="Kas Bank" value={summary.bank} />
          <ReportLine label="Total Pemasukan" value={summary.debet} strong />
        </div>
        <div>
          <p className="mb-2 font-bold text-mosque-ink">Pengeluaran</p>
          <ReportLine label="Total Pengeluaran" value={summary.kredit} strong />
        </div>
        <div className="border-t border-slate-300 pt-3">
          <ReportLine label="Saldo Akhir" value={summary.saldo} strong />
        </div>
      </div>
    </div>
  );
}

function ReportLine({ label, strong, value }: { label: string; strong?: boolean; value: number }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] gap-4 py-1 ${strong ? "font-bold text-mosque-ink" : "text-slate-700"}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function LedgerControls({
  ledgerView,
  query,
  setLedgerView,
  setQuery,
}: {
  ledgerView: LedgerView;
  query: string;
  setLedgerView: (view: LedgerView) => void;
  setQuery: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="grid grid-cols-3 rounded border border-slate-200 bg-slate-50 p-1">
        {[
          ["umum", "Umum"],
          ["bank", "Bank"],
          ["tunai", "Tunai"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setLedgerView(value as LedgerView)}
            className={`h-9 rounded px-3 text-sm font-semibold transition ${
              ledgerView === value ? "bg-white text-mosque-green shadow-sm" : "text-slate-600 hover:text-mosque-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="flex h-11 min-w-0 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm text-slate-600 focus-within:border-mosque-green focus-within:ring-2 focus-within:ring-mosque-green/20">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari transaksi" className="min-w-0 border-0 bg-transparent outline-none" />
      </label>
    </div>
  );
}

function LedgerTable({
  attachmentMap,
  onOpenProofs,
  rows,
  totals,
}: {
  attachmentMap: AttachmentMap;
  onOpenProofs: (transaction: Transaction) => void;
  rows: ReturnType<typeof getLedgerRows>;
  totals: { debet: number; kredit: number; saldo: number };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-mosque-leaf text-left text-mosque-ink">
            <th className="border border-slate-700/60 px-3 py-3 font-bold">Tanggal</th>
            <th className="border border-slate-700/60 px-3 py-3 font-bold">Uraian</th>
            <th className="border border-slate-700/60 px-3 py-3 font-bold">No Bukti</th>
            <th className="border border-slate-700/60 px-3 py-3 text-center font-bold">Bukti</th>
            <th className="border border-slate-700/60 px-3 py-3 text-right font-bold">Debet</th>
            <th className="border border-slate-700/60 px-3 py-3 text-right font-bold">Kredit</th>
            <th className="border border-slate-700/60 px-3 py-3 text-right font-bold">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.id}-${item.saldo}`} className={index % 2 === 0 ? "bg-mosque-mint/75" : "bg-sky-100/80"}>
              <td className="border border-slate-700/50 px-3 py-2">{formatDate(item.date)}</td>
              <td className="border border-slate-700/50 px-3 py-2 font-medium text-slate-800">{item.description}</td>
              <td className="border border-slate-700/50 px-3 py-2">{item.proofNumber}</td>
              <td className="border border-slate-700/50 px-3 py-2 text-center">
                <ProofButton
                  attachments={attachmentMap[item.id] ?? []}
                  onClick={() => onOpenProofs(item)}
                />
              </td>
              <td className="border border-slate-700/50 px-3 py-2 text-right">{item.debet ? formatNumber(item.debet) : "-"}</td>
              <td className="border border-slate-700/50 px-3 py-2 text-right">{item.kredit ? formatNumber(item.kredit) : "-"}</td>
              <td className="border border-slate-700/50 px-3 py-2 text-right font-bold">{formatNumber(item.saldo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-200 font-bold">
            <td className="border border-slate-700/60 px-3 py-3" colSpan={4}>Saldo Akhir</td>
            <td className="border border-slate-700/60 px-3 py-3 text-right">{formatNumber(totals.debet)}</td>
            <td className="border border-slate-700/60 px-3 py-3 text-right">{formatNumber(totals.kredit)}</td>
            <td className="border border-slate-700/60 px-3 py-3 text-right">{formatNumber(totals.saldo)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ProofButton({ attachments, onClick }: { attachments: Attachment[]; onClick: () => void }) {
  if (!attachments.length) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center gap-1 rounded border border-mosque-sky/30 bg-white px-2.5 text-xs font-bold text-mosque-sky transition hover:border-mosque-sky hover:bg-sky-50"
      title="Lihat bukti transaksi"
    >
      <Eye aria-hidden="true" className="h-3.5 w-3.5" />
      Bukti
      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-mosque-sky">
        {attachments.length}
      </span>
    </button>
  );
}

function ProofPreviewModal({
  attachments,
  onClose,
  transaction,
}: {
  attachments: Attachment[];
  onClose: () => void;
  transaction: Transaction;
}) {
  const [activeAttachmentId, setActiveAttachmentId] = useState(attachments[0]?.id ?? "");
  const activeAttachment = attachments.find((item) => item.id === activeAttachmentId) ?? attachments[0];

  if (!activeAttachment) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mosque-gold">Bukti Transaksi</p>
            <h2 className="truncate text-lg font-bold text-mosque-ink">{transaction.description}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(transaction.date)} - {transaction.proofNumber} - {formatCurrency(transaction.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-600 transition hover:border-red-200 hover:text-red-600"
            aria-label="Tutup popup bukti"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => setActiveAttachmentId(attachment.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                    activeAttachment.id === attachment.id
                      ? "border-mosque-green bg-white text-mosque-ink shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                  }`}
                >
                  <span className="block truncate font-bold">{attachment.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{Math.round(attachment.size / 1024)} KB</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-h-0 overflow-auto p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-mosque-ink">{activeAttachment.name}</p>
                {activeAttachment.notes ? (
                  <p className="mt-1 text-xs text-slate-500">{activeAttachment.notes}</p>
                ) : null}
              </div>
              <a
                href={activeAttachment.dataUrl}
                download={activeAttachment.name}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 text-xs font-bold text-mosque-sky transition hover:border-mosque-sky"
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Unduh
              </a>
            </div>
            <ProofPreview attachment={activeAttachment} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type.startsWith("image/")) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded border border-slate-200 bg-slate-50 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.dataUrl} alt={attachment.name} className="max-h-[65vh] max-w-full rounded object-contain" />
      </div>
    );
  }

  if (attachment.type === "application/pdf") {
    return (
      <iframe
        src={attachment.dataUrl}
        title={attachment.name}
        className="h-[65vh] w-full rounded border border-slate-200 bg-slate-50"
      />
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <FileText aria-hidden="true" className="h-12 w-12 text-mosque-green" />
      <p className="mt-3 text-sm font-bold text-mosque-ink">Preview file ini belum tersedia di browser.</p>
      <p className="mt-1 text-sm text-slate-600">Gunakan tombol unduh untuk membuka dokumen di aplikasi yang sesuai.</p>
    </div>
  );
}

function ChartPanel({
  children,
  icon,
  kicker,
  title,
}: {
  children: ReactElement;
  icon: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-mosque-gold">{kicker}</p>
          <h2 className="text-lg font-bold text-mosque-ink">{title}</h2>
        </div>
        {icon}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActionButtons({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs font-bold text-mosque-sky transition hover:border-mosque-sky">
        <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
        Edit
      </button>
      <button type="button" onClick={onDelete} className="inline-flex h-8 items-center gap-1 rounded border border-red-200 bg-white px-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50">
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Hapus
      </button>
    </div>
  );
}

function PanelTitle({ compact, icon, kicker, title }: { compact?: boolean; icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className={compact ? "flex items-center gap-2" : "mb-4 flex items-center gap-2"}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-mosque-mint text-mosque-green">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-mosque-gold">{kicker}</p>
        <h2 className="text-lg font-bold text-mosque-ink">{title}</h2>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded px-4 text-sm font-bold transition ${
        active ? "bg-white text-mosque-green shadow-sm" : "text-slate-600 hover:text-mosque-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "green" | "gold" | "sky" | "slate";
}) {
  const tones = {
    green: "bg-mosque-mint text-mosque-green",
    gold: "bg-amber-100 text-mosque-gold",
    sky: "bg-sky-100 text-mosque-sky",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded ${tones[tone]}`}>{icon}</div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-mosque-ink">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-mosque-ink">{label}</span>
      {children}
    </label>
  );
}
