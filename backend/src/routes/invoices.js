const auth = require("../middleware/auth");
const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseStatus(s) {
  if (!s) return undefined;
  if (s === "PAID" || s === "UNPAID") return s;
  return undefined;
}

// "10.05" -> 1005 (cents) tanpa floating error
function toCents(value) {
  const s = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("Total harus format angka dengan max 2 desimal (contoh: 10.05)");
  }
  const [dollars, frac = ""] = s.split(".");
  const frac2 = (frac + "00").slice(0, 2); // pad jadi 2 digit
  return parseInt(dollars, 10) * 100 + parseInt(frac2, 10);
}

router.get("/stats", async (req, res, next) => {
  try {
    const paid = await prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { totalCents: true },
    });
    const unpaid = await prisma.invoice.aggregate({
      where: { status: "UNPAID" },
      _sum: { totalCents: true },
    });
    const all = await prisma.invoice.aggregate({
      _sum: { totalCents: true },
    });

    res.json({
      totalPaidCents: paid._sum.totalCents || 0,
      totalUnpaidCents: unpaid._sum.totalCents || 0,
      totalAllCents: all._sum.totalCents || 0,
    });
  } catch (e) {
    next(e);
  }
});

// Public checker: /api/invoices/check?invoiceNo=INV-001
router.get("/check", async (req, res, next) => {
  try {
    const invoiceNo = String(req.query.invoiceNo || "").trim();
    if (!invoiceNo) return res.status(400).json({ message: "invoiceNo wajib diisi" });

    const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!inv) return res.status(404).json({ message: "Nota tidak ditemukan" });

    res.json(inv);
  } catch (e) {
    next(e);
  }
});

// GET list
router.get("/", async (req, res, next) => {
  try {
    const search = (req.query.search || "").trim();
    const status = req.query.status === "ALL" ? undefined : parseStatus(req.query.status);
    const sort = req.query.sort || "invoiceNo_asc";

    // pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const skip = (page - 1) * limit;

    let orderBy = { invoiceNo: "asc" };
    if (sort === "invoiceNo_desc") orderBy = { invoiceNo: "desc" };

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNo: { contains: search } },
              { customerName: { contains: search } },
            ],
          }
        : {}),
    };

    const total = await prisma.invoice.count({ where });

    const items = await prisma.invoice.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST create invoice
router.post("/", async (req, res, next) => {
  try {
    const { invoiceNo, date, customerName, total, note } = req.body;

    if (!invoiceNo || !date || !customerName || total === undefined) {
      return res.status(400).json({ message: "invoiceNo, date, customerName, total wajib diisi" });
    }

    const totalCents = toCents(total);

    const created = await prisma.invoice.create({
      data: {
        invoiceNo: String(invoiceNo),
        date: new Date(date),
        customerName: String(customerName),
        totalCents,
        note: note ? String(note) : null,
      },
    });

    res.json(created);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ message: "No Nota sudah dipakai (harus unik)" });
    }
    next(e);
  }
});

// PATCH status
router.patch("/:id", async (req, res, next) => {
  try {
    const { status, note, customerName, date, total } = req.body;

    const data = {};

    // update status (opsional)
    if (status !== undefined) {
      if (status !== "PAID" && status !== "UNPAID") {
        return res.status(400).json({ message: "status harus PAID atau UNPAID" });
      }
      data.status = status;
      data.paidAt = status === "PAID" ? new Date() : null;
    }

    // update note/keterangan (opsional)
    if (note !== undefined) {
      data.note = String(note).trim() === "" ? null : String(note);
    }

    // update nama pelanggan (opsional)
    if (customerName !== undefined) {
      const v = String(customerName).trim();
      if (!v) return res.status(400).json({ message: "customerName tidak boleh kosong" });
      data.customerName = v;
    }

    // update tanggal (opsional)
    if (date !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return res.status(400).json({ message: "date tidak valid" });
      data.date = d;
    }

    // update total USD (opsional) -> totalCents
    if (total !== undefined) {
      data.totalCents = toCents(total);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Tidak ada data untuk diupdate" });
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;