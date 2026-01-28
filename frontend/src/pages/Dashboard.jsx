import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  DropdownButton,
  Dropdown,
  Spinner,
  Toast,
  ToastContainer,
} from "react-bootstrap";

function formatUSDFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export default function Dashboard() {
  // filter/sort
  const [searchInput, setSearchInput] = useState("");
const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("invoiceNo_asc");

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  const params = useMemo(
    () => ({ search, status, sort, page, limit }),
    [search, status, sort, page, limit]
  );

  // untuk export (tanpa page/limit)
  const exportParams = useMemo(() => ({ search, status, sort }), [search, status, sort]);

  // data
  const [stats, setStats] = useState({
    totalPaidCents: 0,
    totalUnpaidCents: 0,
    totalAllCents: 0,
  });
  const [items, setItems] = useState([]);

  // form tambah
  const [form, setForm] = useState({
    invoiceNo: "",
    date: "",
    customerName: "",
    total: "",
    note: "",
  });
//tambah
const [toast, setToast] = useState({
  show: false,
  variant: "success", // success | danger | warning | info
  title: "",
  message: "",
});

function showToast(variant, title, message) {
  setToast({ show: true, variant, title, message });
}

  // row editing
  const [editingRowId, setEditingRowId] = useState(null);
  const [editRow, setEditRow] = useState({
    customerName: "",
    date: "",
    total: "",
    note: "",
  });

  // UI state
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState({ pdf: false, excel: false });
  const [savingRowId, setSavingRowId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await axios.get("/api/invoices/stats");
      setStats(res.data);
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadInvoices() {
    setLoadingInvoices(true);
    try {
      const res = await axios.get("/api/invoices", { params });
      setItems(res.data.items);
      setMeta(res.data.meta);
    } finally {
      setLoadingInvoices(false);
    }
  }

  // reset page kalau filter berubah
  useEffect(() => {
    setPage(1);
  }, [search, status, sort, limit]);

  useEffect(() => {
    loadStats().catch(console.error);
  }, []);

  useEffect(() => {
    loadInvoices().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
//useEffect debounce
useEffect(() => {
  const t = setTimeout(() => {
    setSearch(searchInput.trim());
  }, 400);
  return () => clearTimeout(t);
}, [searchInput]);
  async function handleSubmit(e) {
  e.preventDefault();
  setSubmitting(true);

  try {
    await axios.post("/api/invoices", {
      invoiceNo: form.invoiceNo,
      date: form.date,
      customerName: form.customerName,
      total: form.total,
      note: form.note,
    });

    setForm({ invoiceNo: "", date: "", customerName: "", total: "", note: "" });
    await loadInvoices();
    await loadStats();

    showToast("success", "Berhasil", "Nota berhasil disimpan");
  } catch (err) {
    showToast("danger", "Gagal", err?.response?.data?.message || "Gagal menyimpan nota");
  } finally {
    setSubmitting(false);
  }
}

  async function toggleStatus(id, newStatus) {
    await axios.patch(`/api/invoices/${id}`, { status: newStatus });
    await loadInvoices();
    await loadStats();
  }

  async function removeInvoice(id) {
    if (!confirm("Hapus nota ini?")) return;
    setDeletingRowId(id);
    try {
      await axios.delete(`/api/invoices/${id}`);
      await loadInvoices();
      await loadStats();
    } finally {
      setDeletingRowId(null);
    }
  }

  async function exportExcel() {
    setExporting((s) => ({ ...s, excel: true }));
    try {
      const res = await axios.get("/api/exports/excel", {
        params: exportParams,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting((s) => ({ ...s, excel: false }));
    }
  }

  async function exportPDF() {
    setExporting((s) => ({ ...s, pdf: true }));
    try {
      const res = await axios.get("/api/exports/pdf", {
        params: exportParams,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting((s) => ({ ...s, pdf: false }));
    }
  }

  async function copyCheckLink(invoiceNo) {
  const link = `${window.location.origin}/check?invoiceNo=${encodeURIComponent(invoiceNo)}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast("success", "Disalin", "Link cek nota sudah disalin ke clipboard");
  } catch {
    showToast("warning", "Copy manual", "Browser tidak mengizinkan clipboard, silakan copy manual");
    prompt("Copy link ini:", link);
  }
}

  function startEditRow(it) {
    setEditingRowId(it.id);
    setEditRow({
      customerName: it.customerName || "",
      date: new Date(it.date).toISOString().slice(0, 10),
      // tampil tanpa memaksa 2 nol di belakang
      total: ((it.totalCents || 0) / 100).toFixed(2).replace(/\.?0+$/, ""),
      note: it.note || "",
    });
  }

  function cancelEditRow() {
    setEditingRowId(null);
    setEditRow({ customerName: "", date: "", total: "", note: "" });
  }

  async function saveEditRow(id) {
    setSavingRowId(id);
    try {
      await axios.patch(`/api/invoices/${id}`, {
        customerName: editRow.customerName,
        date: editRow.date,
        total: editRow.total,
        note: editRow.note,
      });

      cancelEditRow();
      await loadInvoices();
      await loadStats();
    } catch (err) {
      showToast("danger", "Gagal", err?.response?.data?.message || "Gagal update data nota");
    } finally {
      setSavingRowId(null);
    }
  }

  const rowStartNo = (page - 1) * limit;

  return (
    <Container className="py-4" style={{ maxWidth: 980 }}>
      <h3 className="mb-4">Invoice Checker</h3>

      {/* Stats responsive */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={4}>
          <Card className="p-3" style={{ background: "#eafff2" }}>
            <div className="text-muted">Total Paid</div>
            <div className="fs-4 fw-bold">
              {loadingStats ? <Spinner size="sm" /> : formatUSDFromCents(stats.totalPaidCents)}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="p-3" style={{ background: "#fff8e6" }}>
            <div className="text-muted">Total Unpaid</div>
            <div className="fs-4 fw-bold">
              {loadingStats ? <Spinner size="sm" /> : formatUSDFromCents(stats.totalUnpaidCents)}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="p-3" style={{ background: "#eef7ff" }}>
            <div className="text-muted">Total All</div>
            <div className="fs-4 fw-bold">
              {loadingStats ? <Spinner size="sm" /> : formatUSDFromCents(stats.totalAllCents)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Form tambah */}
      <Card className="p-3 mb-4">
        <div className="fw-bold mb-3">Tambah Nota</div>
        <Form onSubmit={handleSubmit}>
          <Row className="g-3">
            <Col md={6}>
              <Form.Control
                placeholder="No Nota"
                value={form.invoiceNo}
                onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                placeholder="Nama Pelanggan"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                placeholder="Total USD (contoh: 10.5 / 10.05)"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
                inputMode="decimal"
                required
              />
              <div className="text-muted" style={{ fontSize: 12 }}>
                Gunakan titik (.) untuk desimal, max 2 angka.
              </div>
            </Col>
            <Col md={12}>
              <Form.Control
                placeholder="Catatan (opsional)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Col>
            <Col md={12}>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Nota"
                )}
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Daftar */}
      <Card className="p-3">
        <div className="fw-bold mb-3">Daftar Nota</div>

        <Row className="g-2 align-items-center mb-3">
          <Col md={5}>
            <Form.Control
              placeholder="Cari nomor atau pelanggan"
              value={searchInput}
onChange={(e) => setSearchInput(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Semua</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="invoiceNo_asc">Urutkan A-Z / 0-9</option>
              <option value="invoiceNo_desc">Urutkan Z-A / 9-0</option>
            </Form.Select>
          </Col>
          <Col md={2} className="d-flex gap-2">
            <Button variant="success" onClick={exportExcel} disabled={exporting.excel}>
              {exporting.excel ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Export...
                </>
              ) : (
                "Export Excel"
              )}
            </Button>
            <Button variant="danger" onClick={exportPDF} disabled={exporting.pdf}>
              {exporting.pdf ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Export...
                </>
              ) : (
                "Export PDF"
              )}
            </Button>
          </Col>
        </Row>

        <Row className="g-2 align-items-center mb-2">
          <Col>
            <div className="text-muted" style={{ fontSize: 13 }}>
              Total data: {meta.total} | Page {meta.page} / {meta.totalPages}
            </div>
          </Col>
          <Col className="d-flex justify-content-end gap-2">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next
            </Button>

            <Form.Select
              size="sm"
              style={{ width: 120 }}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </Form.Select>
          </Col>
        </Row>
<div style={{ maxHeight: "60vh", overflow: "auto" }}>
  <Table bordered hover responsive size="sm">
    <thead>
      <tr>
        <th>No</th>
        <th>No Nota</th>
        <th>Tanggal</th>
        <th>Pelanggan</th>
        <th>Total</th>
        <th>Status</th>
        <th>Tanggal Lunas</th>
        <th>Keterangan</th>
        <th>Aksi</th>
      </tr>
    </thead>

    <tbody>
      {loadingInvoices ? (
        <tr>
          <td colSpan={9} className="text-center text-muted py-4">
            <Spinner size="sm" className="me-2" />
            Loading data...
          </td>
        </tr>
      ) : items.length === 0 ? (
        <tr>
          <td colSpan={9} className="text-center text-muted">
            Data kosong
          </td>
        </tr>
      ) : (
        items.map((it, idx) => {
          const rowIsEditing = editingRowId === it.id;
          const otherRowEditing = editingRowId && !rowIsEditing;

          return (
            <tr key={it.id}>
              <td>{rowStartNo + idx + 1}</td>
              <td>{it.invoiceNo}</td>

              <td>
                {rowIsEditing ? (
                  <Form.Control
                    size="sm"
                    type="date"
                    value={editRow.date}
                    onChange={(e) => setEditRow({ ...editRow, date: e.target.value })}
                  />
                ) : (
                  new Date(it.date).toISOString().slice(0, 10)
                )}
              </td>

              <td style={{ minWidth: 160 }}>
                {rowIsEditing ? (
                  <Form.Control
                    size="sm"
                    value={editRow.customerName}
                    onChange={(e) => setEditRow({ ...editRow, customerName: e.target.value })}
                  />
                ) : (
                  it.customerName
                )}
              </td>

              <td style={{ minWidth: 130 }}>
                {rowIsEditing ? (
                  <Form.Control
                    size="sm"
                    value={editRow.total}
                    onChange={(e) => setEditRow({ ...editRow, total: e.target.value })}
                    placeholder="10.5 / 10.05"
                    inputMode="decimal"
                  />
                ) : (
                  formatUSDFromCents(it.totalCents)
                )}
              </td>

              <td>
                {it.status === "PAID" ? (
                  <Badge bg="success">PAID</Badge>
                ) : (
                  <Badge bg="warning" text="dark">
                    UNPAID
                  </Badge>
                )}
              </td>

              <td>{it.paidAt ? new Date(it.paidAt).toISOString().slice(0, 10) : "-"}</td>

              <td style={{ minWidth: 220 }}>
                {rowIsEditing ? (
                  <Form.Control
                    size="sm"
                    value={editRow.note}
                    onChange={(e) => setEditRow({ ...editRow, note: e.target.value })}
                    placeholder="Keterangan..."
                  />
                ) : (
                  it.note || "-"
                )}
              </td>

              <td>
                <DropdownButton
                  size="sm"
                  variant="outline-secondary"
                  title="Aksi"
                  disabled={otherRowEditing || deletingRowId === it.id}
                >
                  {rowIsEditing ? (
                    <>
                      <Dropdown.Item
                        disabled={savingRowId === it.id}
                        onClick={() => saveEditRow(it.id)}
                      >
                        {savingRowId === it.id ? "Menyimpan..." : "Simpan"}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={cancelEditRow}>Batal</Dropdown.Item>
                    </>
                  ) : (
                    <Dropdown.Item onClick={() => startEditRow(it)}>Edit</Dropdown.Item>
                  )}

                  <Dropdown.Divider />

                  <Dropdown.Item
                    disabled={rowIsEditing}
                    onClick={() =>
                      toggleStatus(it.id, it.status === "UNPAID" ? "PAID" : "UNPAID")
                    }
                  >
                    {it.status === "UNPAID" ? "Tandai Paid" : "Batalkan Paid"}
                  </Dropdown.Item>

                  <Dropdown.Item disabled={rowIsEditing} onClick={() => copyCheckLink(it.invoiceNo)}>
  Copy Link Cek
</Dropdown.Item>

                  <Dropdown.Divider />

                  <Dropdown.Item
                    className="text-danger"
                    disabled={rowIsEditing}
                    onClick={() => removeInvoice(it.id)}
                  >
                    Hapus
                  </Dropdown.Item>
                </DropdownButton>
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </Table>
</div>
      </Card>
<ToastContainer position="bottom-end" className="p-3">
  <Toast
    bg={toast.variant}
    show={toast.show}
    onClose={() => setToast((t) => ({ ...t, show: false }))}
    delay={2500}
    autohide
  >
    <Toast.Header closeButton={true}>
      <strong className="me-auto">{toast.title}</strong>
    </Toast.Header>
    <Toast.Body className={toast.variant === "warning" ? "text-dark" : "text-white"}>
      {toast.message}
    </Toast.Body>
  </Toast>
</ToastContainer>
    </Container>
  );
}