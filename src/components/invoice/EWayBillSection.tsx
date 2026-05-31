"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Types

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
  dispatch_from_location_id: string;
  dispatch_from_supplier_id: string;
  ship_to_client_id:   string;
  ship_to_branch_id:   string;
  ship_to_location_id: string;
};

type Location = {
  id: string; name: string; type: string;
  address: string | null; city: string | null; state_code: string | null;
  pincode: string | null; gstin: string | null;
};

type Supplier = {
  id: string; name: string;
  address: string | null; city: string | null; state_code: string | null;
  pincode: string | null; gstin: string | null;
};

type Client = {
  id: string; name: string; gstin: string | null;
  address: string; city: string | null; state_code: string; pincode: string | null;
};

type Branch = {
  id: string; client_id: string; label: string; client_name: string;
  gstin: string | null; address: string | null; city: string | null;
  state_code: string | null; pincode: string | null;
};

// Prefixed value helpers
function dispatchPrefixed(ewb: EWayBillData): string {
  if (ewb.dispatch_from_location_id) return `loc:${ewb.dispatch_from_location_id}`;
  if (ewb.dispatch_from_supplier_id) return `sup:${ewb.dispatch_from_supplier_id}`;
  return "";
}

function shipToPrefixed(ewb: EWayBillData): string {
  if (ewb.ship_to_client_id)   return `cli:${ewb.ship_to_client_id}`;
  if (ewb.ship_to_branch_id)   return `brn:${ewb.ship_to_branch_id}`;
  if (ewb.ship_to_location_id) return `loc:${ewb.ship_to_location_id}`;
  return "";
}

const DEFAULTS: EWayBillData = {
  supply_type: "O", sub_supply_type: 1, transport_mode: "1",
  distance_km: 0, transporter_name: "", transporter_id: "",
  vehicle_no: "", vehicle_type: "R", trans_doc_no: "", trans_doc_date: "",
  eway_bill_number: "", valid_until: "",
  dispatch_from_location_id: "", dispatch_from_supplier_id: "",
  ship_to_client_id: "", ship_to_branch_id: "", ship_to_location_id: "",
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

function transactionTypeLabel(ewb: EWayBillData): string | null {
  const hasDispatch = !!(ewb.dispatch_from_location_id || ewb.dispatch_from_supplier_id);
  const hasShipTo   = !!(ewb.ship_to_client_id || ewb.ship_to_branch_id || ewb.ship_to_location_id);
  if (hasDispatch && hasShipTo)  return "Type 2 — Combination (Dispatch From + Ship To)";
  if (hasDispatch)               return "Type 3 — Dispatch From differs from seller";
  if (hasShipTo)                 return "Type 4 — Ship To differs from buyer";
  return null;
}

function sel(
  label: string,
  value: string,
  onChange: (v: string) => void,
  options: { value: string; label: string }[]
) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function PartyCard({
  name, gstin, address, city, state_code, pincode, color,
}: {
  name: string; gstin?: string | null; address?: string | null;
  city?: string | null; state_code?: string | null; pincode?: string | null;
  color: "blue" | "green";
}) {
  const cls = color === "blue"
    ? { border: "border-blue-200", bg: "bg-blue-50", name: "text-blue-800 font-semibold", muted: "text-blue-700", mono: "text-blue-600" }
    : { border: "border-green-200", bg: "bg-green-50", name: "text-green-800 font-semibold", muted: "text-green-700", mono: "text-green-600" };
  return (
    <div className={`rounded-md border ${cls.border} ${cls.bg} px-3 py-2 text-xs space-y-0.5`}>
      <p className={cls.name}>{name}</p>
      {gstin && <p className={`${cls.mono} font-mono`}>{gstin}</p>}
      {address && <p className={cls.muted}>{address}</p>}
      {(city || pincode) && <p className={cls.muted}>{[city, pincode].filter(Boolean).join(" – ")}</p>}
      {state_code && <p className={cls.mono}>State: {state_code}</p>}
    </div>
  );
}

export function EWayBillSection({
  apiBase,
  subSupplyDefault = 1,
}: {
  apiBase: string;
  subSupplyDefault?: number;
}) {
  const [ewb, setEwb]               = useState<EWayBillData>({ ...DEFAULTS, sub_supply_type: subSupplyDefault });
  const [loaded, setLoaded]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [locations, setLocations]   = useState<Location[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [branches, setBranches]     = useState<Branch[]>([]);

  useEffect(() => {
    const safe = (p: Promise<Response>) =>
      p.then((r) => r.json()).catch(() => ({ data: null }));

    Promise.all([
      safe(fetch(`${apiBase}/eway-bill`)),
      safe(fetch("/api/locations")),
      safe(fetch("/api/suppliers")),
      safe(fetch("/api/clients")),
      safe(fetch("/api/client-branches")),
    ]).then(([ewbJson, locJson, supJson, cliJson, brnJson]) => {
      if (locJson.data) setLocations(locJson.data);
      if (supJson.data) setSuppliers(supJson.data);
      if (cliJson.data) setClients(cliJson.data);
      if (brnJson.data) setBranches(brnJson.data);
      if (ewbJson.data) {
        const d = ewbJson.data;
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
          dispatch_from_location_id: d.dispatch_from_location_id ?? "",
          dispatch_from_supplier_id: d.dispatch_from_supplier_id ?? "",
          ship_to_client_id:         d.ship_to_client_id         ?? "",
          ship_to_branch_id:         d.ship_to_branch_id         ?? "",
          ship_to_location_id:       d.ship_to_location_id       ?? "",
        });
      } else {
        setEwb({ ...DEFAULTS, sub_supply_type: subSupplyDefault });
      }
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  function set<K extends keyof EWayBillData>(field: K, value: EWayBillData[K]) {
    setEwb((prev) => ({ ...prev, [field]: value }));
  }

  function handleDispatchFromChange(prefixed: string) {
    const [prefix, id] = prefixed ? prefixed.split(":") : ["", ""];
    setEwb((prev) => ({
      ...prev,
      dispatch_from_location_id: prefix === "loc" ? id : "",
      dispatch_from_supplier_id: prefix === "sup" ? id : "",
    }));
  }

  function handleShipToChange(prefixed: string) {
    const [prefix, id] = prefixed ? prefixed.split(":") : ["", ""];
    setEwb((prev) => ({
      ...prev,
      ship_to_client_id:   prefix === "cli" ? id : "",
      ship_to_branch_id:   prefix === "brn" ? id : "",
      ship_to_location_id: prefix === "loc" ? id : "",
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...ewb,
        transporter_name: ewb.transporter_name || null,
        transporter_id:   ewb.transporter_id   || null,
        vehicle_no:       ewb.vehicle_no        || null,
        trans_doc_no:     ewb.trans_doc_no      || null,
        trans_doc_date:   ewb.trans_doc_date    || null,
        eway_bill_number: ewb.eway_bill_number  || null,
        valid_until:      ewb.valid_until       || null,
        dispatch_from_location_id: ewb.dispatch_from_location_id || null,
        dispatch_from_supplier_id: ewb.dispatch_from_supplier_id || null,
        ship_to_client_id:         ewb.ship_to_client_id         || null,
        ship_to_branch_id:         ewb.ship_to_branch_id         || null,
        ship_to_location_id:       ewb.ship_to_location_id       || null,
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
      a.download = match?.[1] ?? "eway-bill.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("NIC JSON downloaded — upload it to ewaybillgst.gov.in");
    } finally {
      setDownloading(false);
    }
  }

  if (!loaded) return null;

  const isRoad  = ewb.transport_mode === "1";
  const txLabel = transactionTypeLabel(ewb);

  type SimpleParty = { name: string; gstin: string | null; address: string | null; city: string | null; state_code: string | null; pincode: string | null };

  const dispatchParty: SimpleParty | null =
    ewb.dispatch_from_location_id
      ? (() => { const l = locations.find((x) => x.id === ewb.dispatch_from_location_id); return l ? { name: l.name, gstin: l.gstin, address: l.address, city: l.city, state_code: l.state_code, pincode: l.pincode } : null; })()
      : ewb.dispatch_from_supplier_id
      ? (() => { const s = suppliers.find((x) => x.id === ewb.dispatch_from_supplier_id); return s ? { name: s.name, gstin: s.gstin, address: s.address, city: s.city, state_code: s.state_code, pincode: s.pincode } : null; })()
      : null;

  const shipToParty: SimpleParty | null =
    ewb.ship_to_client_id
      ? (() => { const c = clients.find((x) => x.id === ewb.ship_to_client_id); return c ? { name: c.name, gstin: c.gstin, address: c.address, city: c.city, state_code: c.state_code, pincode: c.pincode } : null; })()
      : ewb.ship_to_branch_id
      ? (() => { const b = branches.find((x) => x.id === ewb.ship_to_branch_id); return b ? { name: `${b.label} (${b.client_name})`, gstin: b.gstin, address: b.address, city: b.city, state_code: b.state_code, pincode: b.pincode } : null; })()
      : ewb.ship_to_location_id
      ? (() => { const l = locations.find((x) => x.id === ewb.ship_to_location_id); return l ? { name: l.name, gstin: l.gstin, address: l.address, city: l.city, state_code: l.state_code, pincode: l.pincode } : null; })()
      : null;

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
          Fill transport details, then download the NIC JSON and upload it to{" "}
          <a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer"
            className="underline text-blue-600 hover:text-blue-800">
            ewaybillgst.gov.in
          </a>
          . Enter the generated e-Way Bill number once the portal confirms.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* Supply */}
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

        {/* Transport */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Transport</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sel("Mode", ewb.transport_mode, (v) => set("transport_mode", v), TRANSPORT_MODES)}
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (km)</Label>
              <Input type="number" min="0" value={ewb.distance_km}
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
          <Button variant="outline" onClick={handleDownloadJson} disabled={downloading || saving}>
            {downloading ? "Generating…" : "↓ Download NIC JSON"}
          </Button>
        </div>

        {/* Dispatch From / Ship To */}
        <div className="border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Dispatch From / Ship To
            <span className="font-normal normal-case text-gray-400 ml-1">(optional)</span>
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Leave both blank for a regular sale. Set <strong>Dispatch From</strong> when goods leave
            from a location other than your registered address (your warehouse or a supplier for
            triangular supply). Set <strong>Ship To</strong> when goods are delivered to a different
            address than the billed party (client branch, different client, or your own location for
            stock transfers).
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Dispatch From */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">📦 Dispatch From</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={dispatchPrefixed(ewb)}
                onChange={(e) => handleDispatchFromChange(e.target.value)}
              >
                <option value="">— Same as seller (default) —</option>
                {locations.length > 0 && (
                  <optgroup label="My Locations">
                    {locations.map((l) => (
                      <option key={l.id} value={`loc:${l.id}`}>
                        {l.name}{l.city ? ` · ${l.city}` : ""}{l.state_code ? ` (${l.state_code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suppliers.length > 0 && (
                  <optgroup label="Suppliers (Triangular Supply)">
                    {suppliers.map((s) => (
                      <option key={s.id} value={`sup:${s.id}`}>
                        {s.name}{s.city ? ` · ${s.city}` : ""}{s.state_code ? ` (${s.state_code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {dispatchParty && (
                <PartyCard
                  name={dispatchParty.name}
                  gstin={dispatchParty.gstin}
                  address={dispatchParty.address}
                  city={dispatchParty.city}
                  state_code={dispatchParty.state_code}
                  pincode={dispatchParty.pincode}
                  color="blue"
                />
              )}
            </div>

            {/* Ship To */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">🚚 Ship To</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={shipToPrefixed(ewb)}
                onChange={(e) => handleShipToChange(e.target.value)}
              >
                <option value="">— Same as buyer (default) —</option>
                {clients.length > 0 && (
                  <optgroup label="Clients (Different Consignee)">
                    {clients.map((c) => (
                      <option key={c.id} value={`cli:${c.id}`}>
                        {c.name}{c.city ? ` · ${c.city}` : ""}{c.state_code ? ` (${c.state_code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {branches.length > 0 && (
                  <optgroup label="Client Branches (Multi-GSTIN)">
                    {branches.map((b) => (
                      <option key={b.id} value={`brn:${b.id}`}>
                        {b.label} — {b.client_name}{b.state_code ? ` (${b.state_code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {locations.length > 0 && (
                  <optgroup label="My Locations (Stock Transfer)">
                    {locations.map((l) => (
                      <option key={l.id} value={`loc:${l.id}`}>
                        {l.name}{l.city ? ` · ${l.city}` : ""}{l.state_code ? ` (${l.state_code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {shipToParty && (
                <PartyCard
                  name={shipToParty.name}
                  gstin={shipToParty.gstin}
                  address={shipToParty.address}
                  city={shipToParty.city}
                  state_code={shipToParty.state_code}
                  pincode={shipToParty.pincode}
                  color="green"
                />
              )}
            </div>
          </div>

          {txLabel && (
            <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
              NIC transaction type: <strong>{txLabel}</strong>
            </p>
          )}
        </div>

        {/* After portal upload */}
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
          <div className="mt-4">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Details"}
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
