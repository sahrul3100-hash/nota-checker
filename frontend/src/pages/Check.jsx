import { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { Container, Card, Form, Button, Badge } from "react-bootstrap";

function formatUSDFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export default function Check() {
  const [searchParams] = useSearchParams();

  const [invoiceNo, setInvoiceNo] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function doCheck(no) {
    setError("");
    setResult(null);

    const cleaned = String(no || "").trim();
    if (!cleaned) {
      setError("invoiceNo wajib diisi");
      return;
    }

    try {
      const res = await axios.get("/api/invoices/check", { params: { invoiceNo: cleaned } });
      setResult(res.data);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 404) setError("TIDAK DITEMUKAN");
      else setError(err?.response?.data?.message || "Gagal cek nota");
    }
  }

  // Auto check kalau ada query ?invoiceNo=...
  useEffect(() => {
    const q = searchParams.get("invoiceNo");
    if (q) {
      setInvoiceNo(q);
      doCheck(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onSubmit(e) {
    e.preventDefault();
    await doCheck(invoiceNo);
  }

  return (
    <Container className="py-4" style={{ maxWidth: 700 }}>
      <h3 className="mb-3">Cek Nota</h3>

      <Card className="p-3 mb-3">
        <Form onSubmit={onSubmit}>
          <Form.Control
            placeholder="Masukkan No Nota (contoh: INV-2026-0001)"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            required
          />
          <div className="mt-3">
            <Button type="submit">Cek</Button>
          </div>
        </Form>
      </Card>

      {error && (
        <Card className="p-3 border-danger">
          <div className="mb-2">
            Hasil: <Badge bg="danger">{error}</Badge>
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Pastikan No Nota benar.
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-3">
          <div className="mb-2">
            Hasil: <Badge bg="primary">VALID</Badge>{" "}
            {result.status === "PAID" ? (
              <Badge bg="success">PAID</Badge>
            ) : (
              <Badge bg="warning" text="dark">
                UNPAID
              </Badge>
            )}
          </div>

          <div><b>No Nota:</b> {result.invoiceNo}</div>
          <div><b>Tanggal:</b> {new Date(result.date).toISOString().slice(0, 10)}</div>
          <div><b>Pelanggan:</b> {result.customerName}</div>
          <div><b>Total:</b> {formatUSDFromCents(result.totalCents)}</div>
          <div><b>Tanggal Lunas:</b> {result.paidAt ? new Date(result.paidAt).toISOString().slice(0, 10) : "-"}</div>
          <div><b>Keterangan:</b> {result.note || "-"}</div>
        </Card>
      )}
    </Container>
  );
}