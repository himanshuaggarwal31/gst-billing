"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type EInvoiceData = {
  irn:             string;
  ack_no:          string;
  ack_date:        string;
  signed_qr:       string;
  status:          "pending" | "generated" | "cancelled";
  cancel_irn_hash: string;
  cancel_date:     string;
  cancel_remark:   string;
};

const DEFAULTS: EInvoiceData = {
  irn:             "",
  ack_no:          "",
  ack_date:        "",
  signed_qr:       "",
  status:          "pending",
  cancel_irn_hash: "",
  cancel_date:     "",
  cancel_remark:   "",
};

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-700 border-amber-200",
  generated:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:  "bg-red-50 text-red-700 border-red-200",
};

export function EInvoiceSection({ invoiceId }: { invoiceId: string }) {
  const [ei, setEi]               = useState<EInvoiceData>(DEFAULTS);
  const [loaded, setLoaded]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}/e-invoice`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const d = json.data;
          setEi({
            irn:             d.irn             ?? "",
            ack_no:          d.ack_no          ?? "",
            ack_date:        d.ack_date        ?? "",
            signed_qr:       d.signed_qr       ?? "",
            status:          d.status          ?? "pending",
            cancel_irn_hash: d.cancel_irn_hash ?? "",
            cancel_date:     d.cancel_date     ?? "",
            cancel_remark:   d.cancel_remark   ?? "",
          });
        }
        setLoaded(true);
      });
  }, [invoiceId]);

  // Render QR code whenever signed_qr changes
  useEffect(() => {
    if (!ei.signed_qr) { setQrDataUrl(null); return; }
    // Dynamically import qrcode to avoid SSR issues
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(ei.signed_qr, { width: 160, margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null));
    });
  }, [ei.signed_qr]);

  function set<K extends keyof EInvoiceData>(field: K, value: EInvoiceData[K]) {
    setEi((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        irn:             ei.irn             || null,
        ack_no:          ei.ack_no          || null,
        ack_date:        ei.ack_date        || null,
        signed_qr:       ei.signed_qr       || null,
        status:          ei.irn ? "generated" : "pending",
        cancel_irn_hash: ei.cancel_irn_hash || null,
        cancel_date:     ei.cancel_date     || null,
        cancel_remark:   ei.cancel_remark   || null,
      };
      const res  = await fetch(`/api/invoices/${invoiceId}/e-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to save");
      } else {
        setEi((prev) => ({ ...prev, status: json.data.status }));
        toast.success("e-Invoice details saved");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadJson() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-invoice/json`);
      if (!res.ok) {
        let msg = "Failed to generate JSON";
        try { const j = await res.json(); msg = j.error ?? msg; } catch { /* empty */ }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      const cd    = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download   = match?.[1] ?? "einvoice.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("NIC JSON downloaded — upload it to einvoice1.gst.gov.in");
    } finally {
      setDownloading(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          e-Invoice (IRN)
          {ei.status !== "pending" && (
            <span className={`text-xs font-normal border rounded-full px-2 py-0.5 capitalize ${STATUS_STYLES[ei.status] ?? ""}`}>
              {ei.status}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Generate the NIC JSON and upload it to{" "}
          <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noreferrer"
            className="underline text-blue-600 hover:text-blue-800">
            einvoice1.gst.gov.in
          </a>
          . Paste the IRN, Ack No, and Signed QR Code returned by the portal below.
          {" "}e-Invoice is mandatory for businesses with annual turnover &gt; ₹5 Cr.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Step 1: Download JSON */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Step 1 — Download &amp; Upload to IRP Portal
          </p>
          <Button variant="outline" onClick={handleDownloadJson} disabled={downloading}>
            {downloading ? "Generating…" : "↓ Download NIC JSON"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Upload this JSON to the IRP portal. The portal returns an IRN, Ack No, and Signed QR Code.
          </p>
        </div>

        {/* Step 2: Enter IRP response */}
        <div className="border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Step 2 — Enter Portal Response
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">IRN (Invoice Reference Number)</Label>
              <Input
                value={ei.irn}
                onChange={(e) => set("irn", e.target.value)}
                placeholder="64-character hex string"
                className="font-mono text-xs"
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Acknowledgement Number</Label>
              <Input
                value={ei.ack_no}
                onChange={(e) => set("ack_no", e.target.value)}
                placeholder="ACK number from portal"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Acknowledgement Date</Label>
              <Input
                type="date"
                value={ei.ack_date}
                onChange={(e) => set("ack_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Signed QR Code (from IRP)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                value={ei.signed_qr}
                onChange={(e) => set("signed_qr", e.target.value)}
                placeholder="Paste the SignedQRCode value from IRP response here…"
              />
              <p className="text-xs text-muted-foreground">
                This is the digitally signed string returned by IRP. It will be rendered as a QR code on the invoice.
              </p>
            </div>
          </div>

          {/* QR code preview */}
          {qrDataUrl && (
            <div className="mt-4 flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="e-Invoice QR Code" width={128} height={128} className="border rounded" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-gray-700">QR Code Preview</p>
                <p>This QR code encodes the digitally signed invoice data as per IRP requirements.</p>
                {ei.irn && <p className="font-mono break-all text-[10px]">IRN: {ei.irn}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Details"}
            </Button>
          </div>
        </div>

        {/* Cancellation section */}
        {ei.status === "generated" && (
          <div className="border-t pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Cancellation (if cancelled on IRP portal)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cancel Date</Label>
                <Input
                  type="date"
                  value={ei.cancel_date}
                  onChange={(e) => set("cancel_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cancellation Remark</Label>
                <Input
                  value={ei.cancel_remark}
                  onChange={(e) => set("cancel_remark", e.target.value)}
                  placeholder="Reason for cancellation"
                />
              </div>
            </div>
            {ei.cancel_date && (
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  set("status", "cancelled");
                  await handleSave();
                }}
                disabled={saving}
              >
                Mark as Cancelled
              </Button>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}