"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type EWayBillData = {
  supply_type:      string;
  sub_supply_type:  number;
  transport_mode:   string;
  distance_km:      number;
  transporter_name: string;
  transporter_id:   string;
  vehicle_no:       string;
  vehicle_type:     string;
  trans_doc_no:     string;
  trans_doc_date:   string;
  eway_bill_number: string;
  valid_until:      string;
};

const DEFAULTS: EWayBillData = {
  supply_type:      "O",
  sub_supply_type:  1,
  transport_mode:   "1",
  distance_km:      0,
  transporter_name: "",
  transporter_id:   "",
  vehicle_no:       "",
  vehicle_type:     "R",
  trans_doc_no:     "",
  trans_doc_date:   "",
  eway_bill_number: "",
  valid_until:      "",
};

const SUB_SUPPLY_TYPES = [
  { value: 1,  label: "Supply" },
  { value: 2,  label: "Import" },
  { value: 3,  label: "Export" },
  { value: 4,  label: "Job Work" },
  { value: 5,  label: "For Own Use" },
  { value: 6,  label: "Job Work Returns" },
  { value: 7,  label: "Sales Return" },
  { value: 8,  label: "Others" },
  { value: 9,  label: "SKD / CKD Assemblies" },
  { value: 10, label: "Delivery Challan / Line Sales" },
  { value: 11, label: "Recipient Not Known" },
  { value: 12, label: "Exhibition or Fairs" },
];

const TRANSPORT_MODES = [
  { value: "1", label: "Road" },
  { value: "2", label: "Rail" },
  { value: "3", label: "Air" },
  { value: "4", label: "Ship / Water" },
];

function sel(label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function EWayBillSection({
  apiBase,
  subSupplyDefault = 1,
}: {
  /** e.g. "/api/invoices/abc123" or "/api/challans/abc123" */
  apiBase: string;
  /** Default sub_supply_type when no record exists yet (1=Supply, 10=Delivery Challan) */
  subSupplyDefault?: number;
}) {
  const [ewb, setEwb]           = useState<EWayBillData>({ ...DEFAULTS, sub_supply_type: subSupplyDefault });
  const [loaded, setLoaded]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/eway-bill`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          // Coerce nulls to empty strings for controlled inputs
          const d = json.data;
          setEwb({
            supply_type:      d.supply_type      ?? "O",
            sub_supply_type:  d.sub_supply_type  ?? subSupplyDefault,
            transport_mode:   d.transport_mode   ?? "1",
            distance_km:      d.distance_km      ?? 0,
            transporter_name: d.transporter_name ?? "",
            transporter_id:   d.transporter_id   ?? "",
            vehicle_no:       d.vehicle_no       ?? "",
            vehicle_type:     d.vehicle_type     ?? "R",
            trans_doc_no:     d.trans_doc_no     ?? "",
            trans_doc_date:   d.trans_doc_date   ?? "",
            eway_bill_number: d.eway_bill_number ?? "",
            valid_until:      d.valid_until      ?? "",
          });
        } else {
          // No record yet — apply caller-specified defaults
          setEwb({ ...DEFAULTS, sub_supply_type: subSupplyDefault });
        }
        setLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  function set<K extends keyof EWayBillData>(field: K, value: EWayBillData[K]) {
    setEwb((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...ewb,
        // Send nulls for empty optional fields
        transporter_name: ewb.transporter_name || null,
        transporter_id:   ewb.transporter_id   || null,
        vehicle_no:       ewb.vehicle_no        || null,
        trans_doc_no:     ewb.trans_doc_no      || null,
        trans_doc_date:   ewb.trans_doc_date    || null,
        eway_bill_number: ewb.eway_bill_number  || null,
        valid_until:      ewb.valid_until        || null,
      };
      const res  = await fetch(`${apiBase}/eway-bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to save");
      } else {
        toast.success("e-Way Bill details saved");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadJson() {
    // Save first, then download
    await handleSave();
    setDownloading(true);
    try {
      const res = await fetch(`${apiBase}/eway-bill/json`);
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
      a.download   = match?.[1] ?? "eway-bill.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("NIC JSON downloaded — upload it to ewaybillgst.gov.in");
    } finally {
      setDownloading(false);
    }
  }

  if (!loaded) return null;

  const isRoad = ewb.transport_mode === "1";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          e-Way Bill
          {ewb.eway_bill_number && (
            <span className="text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-mono">
              {ewb.eway_bill_number}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Fill transport details below, then download the NIC JSON and upload it to{" "}
          <a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer"
            className="underline text-blue-600 hover:text-blue-800">
            ewaybillgst.gov.in
          </a>
          . Enter the generated bill number once the portal confirms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Section 1: Supply */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Supply</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sel("Supply Type", ewb.supply_type, (v) => set("supply_type", v), [
              { value: "O", label: "Outward (Sales)" },
              { value: "I", label: "Inward (Purchase)" },
            ])}
            {sel("Sub Supply Type", String(ewb.sub_supply_type),
              (v) => set("sub_supply_type", Number(v)),
              SUB_SUPPLY_TYPES.map((s) => ({ value: String(s.value), label: s.label }))
            )}
          </div>
        </div>

        {/* Section 2: Transport */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Transport</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sel("Mode", ewb.transport_mode, (v) => set("transport_mode", v), TRANSPORT_MODES)}
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (km)</Label>
              <Input type="number" min="0"
                value={ewb.distance_km}
                onChange={(e) => set("distance_km", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transporter Name</Label>
              <Input value={ewb.transporter_name}
                onChange={(e) => set("transporter_name", e.target.value)}
                placeholder="e.g. Speedy Logistics" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transporter GSTIN (optional)</Label>
              <Input value={ewb.transporter_id}
                onChange={(e) => set("transporter_id", e.target.value.toUpperCase())}
                placeholder="29AAAAA0000A1Z5" className="font-mono text-xs" />
            </div>

            {isRoad ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vehicle No.</Label>
                  <Input value={ewb.vehicle_no}
                    onChange={(e) => set("vehicle_no", e.target.value.toUpperCase())}
                    placeholder="UP14AB1234" className="font-mono text-xs" />
                </div>
                {sel("Vehicle Type", ewb.vehicle_type, (v) => set("vehicle_type", v), [
                  { value: "R", label: "Regular" },
                  { value: "O", label: "Over Dimensional Cargo (ODC)" },
                ])}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Doc No. (LR / RR / AWB)</Label>
                  <Input value={ewb.trans_doc_no}
                    onChange={(e) => set("trans_doc_no", e.target.value)}
                    placeholder="LR number" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Doc Date</Label>
                  <Input type="date" value={ewb.trans_doc_date}
                    onChange={(e) => set("trans_doc_date", e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Details"}
          </Button>
          <Button onClick={handleDownloadJson} disabled={downloading || saving}>
            {downloading ? "Generating…" : "↓ Download NIC JSON"}
          </Button>
        </div>

        {/* Section 3: After portal upload */}
        <div className="border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            After uploading to portal
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">e-Way Bill Number</Label>
              <Input value={ewb.eway_bill_number}
                onChange={(e) => set("eway_bill_number", e.target.value)}
                placeholder="12-digit number" className="font-mono"
                maxLength={12} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid Until</Label>
              <Input type="date" value={ewb.valid_until}
                onChange={(e) => set("valid_until", e.target.value)} />
            </div>
          </div>
          {(ewb.eway_bill_number || ewb.valid_until) && (
            <div className="flex gap-3 mt-3">
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Bill Number"}
              </Button>
              {ewb.eway_bill_number && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(`${apiBase}/eway-bill/pdf`, "_blank")}
                >
                  🖨 Print e-Way Bill
                </Button>
              )}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
