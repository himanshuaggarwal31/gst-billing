"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type ImportResult = {
  imported: number;
  total?: number;
  errors?: string[];
  rows?: Array<{ id: string; name: string }>;
};

function ImportCard({
  title,
  description,
  templateUrl,
  uploadUrl,
  templateFilename,
  columns,
}: {
  title: string;
  description: string;
  templateUrl: string;
  uploadUrl: string;
  templateFilename: string;
  columns: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Import failed");
      } else {
        const r = json.data as ImportResult;
        setResult(r);
        toast.success(`Imported ${r.imported} ${title.toLowerCase()}${r.imported !== 1 ? "s" : ""}`);
        if (r.errors && r.errors.length > 0) {
          toast.warning(`${r.errors.length} row${r.errors.length !== 1 ? "s" : ""} had errors — check details below`);
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">Required columns:</p>
          <div className="flex flex-wrap gap-1">
            {columns.map((c) => (
              <span key={c} className="font-mono text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = templateUrl;
              a.download = templateFilename;
              a.click();
            }}
          >
            ↓ Download Template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Importing…" : "↑ Upload CSV"}
          </Button>
        </div>

        {result && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <p className="font-medium text-emerald-800">
              ✓ {result.imported} {title.toLowerCase()}{result.imported !== 1 ? "s" : ""} imported
              {result.total && result.total > result.imported ? ` (${result.total - result.imported} skipped)` : ""}
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-medium text-red-700">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ImportPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import your existing data from Excel or other billing software. Download the CSV template,
          fill in your data, and upload it back.
        </p>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <strong>Tips for a smooth import:</strong>
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-xs">
          <li>Download the template first — it shows the exact column format required.</li>
          <li>Keep the header row exactly as-is. Extra columns are ignored.</li>
          <li>Dates must be in <strong>YYYY-MM-DD</strong> format (e.g. 2024-04-01).</li>
          <li>State codes are 2-digit GST state codes (e.g. 27 for Maharashtra, 09 for UP).</li>
          <li>For invoices, each line item is a separate row with the same invoice number.</li>
          <li>Duplicate invoice numbers in invoice import will show an error — use unique numbers.</li>
        </ul>
      </div>

      <ImportCard
        title="Client"
        description="Import your customer list. If a client with the same name already exists, it will be added as a new entry."
        templateUrl="/api/import/clients"
        uploadUrl="/api/import/clients"
        templateFilename="clients-import-template.csv"
        columns={["name *", "gstin", "email", "phone", "address", "city", "state_code *", "pincode"]}
      />

      <ImportCard
        title="Product"
        description="Import your products and services catalog. Each row creates a new item in your catalog."
        templateUrl="/api/import/products"
        uploadUrl="/api/import/products"
        templateFilename="products-import-template.csv"
        columns={["name *", "hsn_sac_code *", "description", "is_service (Y/N)", "default_rate", "gst_rate", "sku", "purchase_rate", "cess_rate"]}
      />

      <ImportCard
        title="Invoice"
        description="Import historical invoices. Each row is one line item — use the same invoice number across multiple rows for multi-item invoices. New clients are created automatically if not found."
        templateUrl="/api/import/invoices"
        uploadUrl="/api/import/invoices"
        templateFilename="invoices-import-template.csv"
        columns={[
          "invoice_number *", "invoice_date *", "due_date", "client_name *",
          "client_gstin", "seller_state_code", "buyer_state_code",
          "description *", "hsn_sac_code *", "quantity *", "rate *",
          "discount_percent", "gst_rate *", "payment_status", "notes",
        ]}
      />
    </div>
  );
}
