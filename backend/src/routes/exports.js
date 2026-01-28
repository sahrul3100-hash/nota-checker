const auth = require("../middleware/auth");
const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");

function parseStatus(s) {
  if (!s || s === "ALL") return undefined;
  if (s === "PAID" || s === "UNPAID") return s;
  return undefined;
}

function formatUSDFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

async function getFilteredInvoices(query) {
  const search = (query.search || "").trim();
  const status = parseStatus(query.status);
  const sort = query.sort || "invoiceNo_asc";

  let orderBy = { invoiceNo: "asc" };
  if (sort === "invoiceNo_desc") orderBy = { invoiceNo: "desc" };

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? { OR: [{ invoiceNo: { contains: search } }, { customerName: { contains: search } }] }
      : {}),
  };

  return prisma.invoice.findMany({ where, orderBy });
}

router.get("/excel", async (req, res, next) => {
  try {
    const items = await getFilteredInvoices(req.query);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Invoices");

    ws.columns = [
      { header: "No Nota", key: "invoiceNo", width: 20 },
      { header: "Tanggal", key: "date", width: 15 },
      { header: "Pelanggan", key: "customerName", width: 25 },
      { header: "Total (USD)", key: "totalUsd", width: 14 },
      { header: "Status", key: "status", width: 10 },
      { header: "Tanggal Lunas", key: "paidAt", width: 18 },
      { header: "Keterangan", key: "note", width: 25 },
    ];

    items.forEach((it) => {
      ws.addRow({
        invoiceNo: it.invoiceNo,
        date: it.date.toISOString().slice(0, 10),
        customerName: it.customerName,
        totalUsd: (it.totalCents || 0) / 100,
        status: it.status,
        paidAt: it.paidAt ? it.paidAt.toISOString().slice(0, 10) : "",
        note: it.note || "",
      });
    });

    ws.getColumn("totalUsd").numFmt = '"$"#,##0.##';

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=invoices.xlsx");

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

router.get("/pdf", async (req, res, next) => {
  try {
    const items = await getFilteredInvoices(req.query);

    const printedAt = new Date();

    const paidCents = items.reduce(
      (sum, it) => sum + (it.status === "PAID" ? (it.totalCents || 0) : 0),
      0
    );
    const unpaidCents = items.reduce(
      (sum, it) => sum + (it.status === "UNPAID" ? (it.totalCents || 0) : 0),
      0
    );
    const grandTotalCents = paidCents + unpaidCents;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=invoices.pdf");

    const doc = new PDFDocument({ margin: 30, size: "A4" });
    doc.pipe(res);

    // Judul
    doc.fontSize(16).font("Helvetica-Bold").text("Daftar Nota", { align: "center" });
    doc.moveDown(0.3);

    // Info cetak
    doc.fontSize(10).font("Helvetica");
    doc.text(`Tanggal Cetak: ${printedAt.toLocaleString("en-US")}`);
    doc.text(`Jumlah Nota: ${items.length}`);

    // Ringkasan total (USD)
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold");
    doc.text(`Total Paid:   ${formatUSDFromCents(paidCents)}`);
    doc.text(`Total Unpaid: ${formatUSDFromCents(unpaidCents)}`);
    doc.text(`Grand Total:  ${formatUSDFromCents(grandTotalCents)}`);
    doc.font("Helvetica");
    doc.moveDown(0.8);

    const table = {
      headers: ["No", "No Nota", "Tanggal", "Pelanggan", "Total", "Status", "Tgl Lunas", "Ket."],
      rows: items.map((it, idx) => [
        String(idx + 1),
        it.invoiceNo,
        it.date.toISOString().slice(0, 10),
        it.customerName,
        formatUSDFromCents(it.totalCents),
        it.status === "PAID" ? "PAID" : "UNPAID",
        it.paidAt ? it.paidAt.toISOString().slice(0, 10) : "-",
        it.note || "-",
      ]),
    };

    await doc.table(table, {
      width: 535,
      columnSpacing: 3,
      padding: 4,
      prepareHeader: () => doc.fontSize(9).font("Helvetica-Bold"),
      prepareRow: () => doc.fontSize(9).font("Helvetica"),
      columnsSize: [25, 80, 55, 110, 70, 55, 60, 80],
    });

    doc.end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;