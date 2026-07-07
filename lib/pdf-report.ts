import { jsPDF } from "jspdf";

import type { LedgerView, Transaction } from "@/lib/cash-flow";

type LedgerRow = Transaction & {
  debet: number;
  kredit: number;
  saldo: number;
};

type PdfLedgerPageData = {
  rows: LedgerRow[];
  title: string;
  totalLabel: string;
  totals: ReturnType<typeof getLedgerTotals>;
  view: LedgerView;
};

const pdfF4Landscape = {
  heightMm: 215,
  widthMm: 330,
};

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

export function buildCashFlowPdf(monthKey: string, transactions: Transaction[]) {
  const monthlyTransactions = [...transactions].sort((a, b) => {
    const dateSort = a.date.localeCompare(b.date);
    return dateSort || a.createdAt.localeCompare(b.createdAt);
  });
  const summary = getSummary(monthlyTransactions);
  const pages: PdfLedgerPageData[] = ([
    ["umum", "BUKU KAS UMUM", "Saldo Akhir"],
    ["bank", "BUKU PEMBANTU KAS BANK", "Saldo Bank Akhir"],
    ["tunai", "BUKU PEMBANTU KAS TUNAI", "Saldo Tunai Akhir"],
  ] as const).map(([view, title, totalLabel]) => {
    const rows = getLedgerRows(monthlyTransactions, view);

    return {
      rows,
      title,
      totalLabel,
      totals: getLedgerTotals(rows),
      view,
    };
  });

  const pdf = new jsPDF({
    format: [pdfF4Landscape.widthMm, pdfF4Landscape.heightMm],
    orientation: "landscape",
    unit: "mm",
  });

  pages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    drawLedgerPdfPage(pdf, {
      closingDay: getMonthEndDayName(monthKey),
      closingDate: getMonthEndDateLabel(monthKey),
      monthLabel: getMonthLabel(monthKey),
      page,
      summary,
    });
  });

  return new Uint8Array(pdf.output("arraybuffer"));
}

function getSummary(transactions: Transaction[]) {
  const debet = transactions
    .filter((item) => item.type === "debet")
    .reduce((total, item) => total + item.amount, 0);
  const kredit = transactions
    .filter((item) => item.type === "kredit")
    .reduce((total, item) => total + item.amount, 0);
  const bank = transactions.reduce((total, item) => {
    if (item.account !== "bank") {
      return total;
    }

    return total + (item.type === "debet" ? item.amount : -item.amount);
  }, 0);
  const tunai = transactions.reduce((total, item) => {
    if (item.account !== "tunai") {
      return total;
    }

    return total + (item.type === "debet" ? item.amount : -item.amount);
  }, 0);

  return {
    bank,
    debet,
    kredit,
    saldo: debet - kredit,
    tunai,
  };
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function getMonthEndDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0);
}

function getMonthEndDateLabel(monthKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(getMonthEndDate(monthKey));
}

function getMonthEndDayName(monthKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
  }).format(getMonthEndDate(monthKey));
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

function getLedgerTotals(rows: LedgerRow[]) {
  return {
    debet: rows.reduce((total, item) => total + item.debet, 0),
    kredit: rows.reduce((total, item) => total + item.kredit, 0),
    saldo: rows.at(-1)?.saldo ?? 0,
  };
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

function drawLedgerPdfPage(
  pdf: jsPDF,
  {
    closingDay,
    closingDate,
    monthLabel,
    page,
    summary,
  }: {
    closingDay: string;
    closingDate: string;
    monthLabel: string;
    page: PdfLedgerPageData;
    summary: { debet: number; kredit: number; saldo: number; bank: number; tunai: number };
  },
) {
  const pageWidth = pdfF4Landscape.widthMm;
  const pageHeight = pdfF4Landscape.heightMm;
  const marginX = 10;
  const tableWidth = pageWidth - marginX * 2;
  const columns = [
    { align: "center" as const, label: "TANGGAL", width: 38 },
    { align: "left" as const, label: "URAIAN", width: 128 },
    { align: "center" as const, label: "NO BUKTI", width: 28 },
    { align: "right" as const, label: "DEBET", width: 42 },
    { align: "right" as const, label: "KREDIT", width: 37 },
    { align: "right" as const, label: "SALDO", width: tableWidth - 273 },
  ];
  const minimumRows = Math.max(page.rows.length, page.view === "tunai" ? 4 : 0);
  const rows: Array<LedgerRow | null> = [
    ...page.rows,
    ...Array.from({ length: Math.max(0, minimumRows - page.rows.length) }, () => null),
  ];
  const headerHeight = 12;
  const totalHeight = 8;
  const tableTargetHeight = page.view === "umum" ? 102 : 124;
  const rowHeight = Math.min(
    page.view === "umum" ? 5.7 : 7,
    Math.max(4.9, (tableTargetHeight - headerHeight - totalHeight) / Math.max(rows.length, 1)),
  );
  const tableY = 37;

  pdf.setFillColor(231, 238, 251);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setTextColor(15, 23, 42);

  drawCenteredText(pdf, page.title, 13, 11.5, "bold");
  drawCenteredText(pdf, 'PEMBANGUNAN MASJID "BABUL JANNAH"', 20, 11, "bold");
  drawCenteredText(pdf, "KANWIL KEMENTERIAN AGAMA PROVINSI LAMPUNG", 27, 11, "bold");
  drawCenteredText(pdf, `BULAN ${monthLabel.toUpperCase()}`, 34, 10, "bold");

  let x = marginX;
  columns.forEach((column) => {
    drawPdfCell(pdf, {
      align: "center",
      fill: [106, 168, 79],
      fontSize: 9.5,
      height: headerHeight,
      mode: "bold",
      text: column.label,
      width: column.width,
      x,
      y: tableY,
    });
    x += column.width;
  });

  rows.forEach((row, index) => {
    const y = tableY + headerHeight + index * rowHeight;
    const fill = index % 2 === 0 ? [215, 230, 221] : [168, 190, 228];
    const values = row
      ? [
          formatDate(row.date),
          row.description,
          row.proofNumber || "-",
          row.debet ? formatNumber(row.debet) : "-",
          row.kredit ? formatNumber(row.kredit) : "-",
          row.saldo ? formatNumber(row.saldo) : "-",
        ]
      : ["", "", "", "", "", ""];

    x = marginX;
    columns.forEach((column, columnIndex) => {
      drawPdfCell(pdf, {
        align: column.align,
        fill,
        fontSize: page.view === "umum" ? 7.1 : 7.6,
        height: rowHeight,
        mode: "normal",
        text: values[columnIndex],
        width: column.width,
        x,
        y,
      });
      x += column.width;
    });
  });

  const footerY = tableY + headerHeight + rows.length * rowHeight;
  drawPdfCell(pdf, {
    align: "left",
    fill: [106, 168, 79],
    fontSize: 8.4,
    height: totalHeight,
    mode: "bold",
    text: page.totalLabel,
    width: columns[0].width + columns[1].width + columns[2].width,
    x: marginX,
    y: footerY,
  });
  x = marginX + columns[0].width + columns[1].width + columns[2].width;
  [page.totals.debet, page.totals.kredit, page.totals.saldo].forEach((value, index) => {
    drawPdfCell(pdf, {
      align: "right",
      fill: [106, 168, 79],
      fontSize: 8.4,
      height: totalHeight,
      mode: "bold",
      text: value ? formatNumber(value) : "-",
      width: columns[index + 3].width,
      x,
      y: footerY,
    });
    x += columns[index + 3].width;
  });

  const tableBottom = footerY + totalHeight;
  if (page.view === "umum") {
    const closingY = tableBottom + 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);
    pdf.text(
      `Pada hari ini, ${closingDay}, tanggal ${closingDate} Buku Kas Tunai dan Buku Kas Bank ditutup`,
      marginX,
      closingY,
    );
    pdf.text("dengan keadaan sebagai berikut:", marginX, closingY + 6);
    drawPdfBalanceLine(pdf, "Buku kas Tunai", summary.tunai, marginX, closingY + 14);
    drawPdfBalanceLine(pdf, "Buku Kas Bank", summary.bank, marginX, closingY + 20);
    drawPdfBalanceLine(pdf, "Jumlah Kas", summary.saldo, marginX, closingY + 27, true);
    drawPdfSignatures(pdf, closingDate, Math.min(pageHeight - 25, closingY + 43), 22);
    return;
  }

  drawPdfSignatures(pdf, closingDate, Math.min(pageHeight - 39, tableBottom + 24));
}

function drawCenteredText(pdf: jsPDF, text: string, y: number, size: number, mode: "bold" | "normal") {
  pdf.setFont("helvetica", mode);
  pdf.setFontSize(size);
  pdf.text(text, pdfF4Landscape.widthMm / 2, y, { align: "center" });
}

function drawPdfCell(
  pdf: jsPDF,
  {
    align,
    fill,
    fontSize,
    height,
    mode,
    text,
    width,
    x,
    y,
  }: {
    align: "left" | "center" | "right";
    fill: number[];
    fontSize: number;
    height: number;
    mode: "bold" | "normal";
    text: string;
    width: number;
    x: number;
    y: number;
  },
) {
  pdf.setDrawColor(17, 24, 39);
  pdf.setFillColor(fill[0], fill[1], fill[2]);
  pdf.setLineWidth(0.35);
  pdf.rect(x, y, width, height, "FD");
  pdf.setFont("helvetica", mode);
  pdf.setFontSize(fontSize);
  pdf.setTextColor(15, 23, 42);

  const padding = 2.2;
  const textX = align === "left" ? x + padding : align === "right" ? x + width - padding : x + width / 2;
  const textY = y + height / 2 + fontSize * 0.12;
  pdf.text(fitPdfText(pdf, text, width - padding * 2), textX, textY, { align });
}

function fitPdfText(pdf: jsPDF, text: string, maxWidth: number) {
  if (!text || pdf.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let fitted = text;
  while (fitted.length > 3 && pdf.getTextWidth(`${fitted}...`) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted.trim()}...`;
}

function drawPdfBalanceLine(pdf: jsPDF, label: string, value: number, x: number, y: number, strong = false) {
  pdf.setFont("helvetica", strong ? "bold" : "normal");
  pdf.setFontSize(8.8);
  pdf.text(label, x, y);
  pdf.text("Rp", x + 42, y);
  if (strong) {
    pdf.setDrawColor(17, 24, 39);
    pdf.setLineWidth(0.35);
    pdf.line(x + 70, y - 4, x + 116, y - 4);
  }
  pdf.text(value ? formatNumber(value) : "-", x + 116, y, { align: "right" });
}

function drawPdfSignatures(pdf: jsPDF, closingDate: string, y: number, nameOffset = 31) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.text("Ketua Panitia", 10, y);
  pdf.text(`Bandar Lampung, ${closingDate}`, 174, y);
  pdf.text("Bendahara", 174, y + 6);
  pdf.setFont("helvetica", "bold");
  pdf.text("Drs. H. Makmur, M.Ag", 10, y + nameOffset);
  pdf.text("M. Sholeh Ghifari, S.E., M.S.Ak.", 174, y + nameOffset);
}
