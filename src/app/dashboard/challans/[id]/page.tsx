"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ChallanDetail = {
  id: string;
  challan_number: string;
  challan_date: string;
  challan_type: "delivery" | "job_work" | "return";
  returnable_type: "returnable" | "non_returnable";
  status: "draft" | "dispatched" | "received" | "returned";
  from_location_name: string | null;
  to_location_name: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  transporter_name: string | null;
  transporter_gstin: string | null;
  transport_mode: string | null;
  distance_km: number | null;
  eway_bill_number: string | null;
  eway_bill_valid_until: string | null;
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  returned_at: string | null;
  clients: {
    id: string; name: string; gstin: string | null;
    address: string | null; city: string | null; state_code: string;
  } | null;
  from_location: { id: string; name: string; type: string; address: string | null } | null;
  to_location: { id: string; name: string; type: string; address: string | null } | null;
  challan_items: {
    id: string; description: string; hsn_sac_code: string;
    quantity: number; unit: string; remarks: string | null; sort_order: number;
  }[];
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:      { color: "bg-gray-100 text-gray-600",          label: "Draft" },
  dispatched: { color: "bg-blue-100 text-blue-700",          label: "Dispatched" },
  received:   { color: "bg-emerald-100 text-emerald-700",    label: "Received" },
  returned:   { color: "bg-violet-100 text-violet-700",      label: "Returned" },
};

const TYPE_LABEL: Record<string, string> = {
  delivery: "Delivery Challan",
  job_work: "Job Work Challan",
  return:   "Return Challan",
};

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  draft:      [{ label: "Mark as Dispatched", value: "dispatched" }],
  dispatched: [{ label: "Mark as Received", value: "received" }, { label: "Mark as Returned", value: "returned" }],
  received:   [{ label: "Mark as Returned",  value: "returned" }],
  returned:   [],
};

export default function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [challan, setChallan] = useState<ChallanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // EWB form state
  const [ewbNumber, setEwbNumber] = useState("");
  const [ewbValidUntil, setEwbValidUntil] = useState("");
  const [transportMode, setTransportMode] = useState("road");
  const [distanceKm, setDistanceKm] = useState("");
  const [transporterGstin, setTransporterGstin] = useState("");
  const [ewbSaving, setEwbSaving] = useState(false);

  async function fetchChallan() {
    setLoading(true);
    const res = await fetch(`/api/challans/${id}`);
    const json = await res.json();
    if (json.data) {
      const c = json.data as ChallanDetail;
      setChallan(c);
      // Populate EWB form
      setEwbNumber(c.eway_bill_number ?? "");
      setEwbValidUntil(c.eway_bill_valid_until ?? "");
      setTransportMode(c.transport_mode ?? "road");
      setDistanceKm(c.distance_km != null ? String(c.distance_km) : "");
      setTransporterGstin(c.transporter_gstin ?? "");
    } else {
      toast.error("Challan not found");
    }
    setLoading(false);
  }

  useEffect(() => { fetchChallan(); }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/challans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success(`Challan marked as ${status}`); fetchChallan(); }
  }

  async function deleteChallan() {
    if (!confirm(`Delete challan ${challan?.challan_number}?`)) return;
    const res = await fetch(`/api/challans/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Challan deleted"); router.push("/dashboard/challans"); }
  }

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/challans/${id}/pdf`);
      if (!res.ok) {
        toast.error("Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `challan-${challan?.challan_number ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function saveEWB() {
    setEwbSaving(true);
    try {
      const res = await fetch(`/api/challans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eway_bill_number:      ewbNumber || null,
          eway_bill_valid_until: ewbValidUntil || null,
          transport_mode:        transportMode || null,
          distance_km:           distanceKm ? parseInt(distanceKm) : null,
          transporter_gstin:     transporterGstin || null,
        }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error.message);
      else { toast.success("e-Way Bill details saved"); fetchChallan(); }
    } finally {
      setEwbSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!challan) return <div className="p-6 text-sm text-red-500">Challan not found.</div>;

  const statusMeta = STATUS_META[challan.status];
  const nextActions = NEXT_STATUS[challan.status] ?? [];
  const sortedItems = [...challan.challan_items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/challans">← Challans</Link>
        </Button>
        <div className="flex-1" />
        {challan.status === "draft" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/challans/${id}/edit`}>Edit</Link>
          </Button>
        )}
        {nextActions.map((a) => (
          <Button key={a.value} size="sm" variant="outline" onClick={() => updateStatus(a.value)}>
            {a.label}
          </Button>
        ))}
        <Button size="sm" onClick={handleDownloadPDF} disabled={downloading}>
          {downloading ? "Generating…" : "↓ Download PDF"}
        </Button>
        <Button variant="destructive" size="sm" onClick={deleteChallan}>Delete</Button>
      </div>

      {/* Challan Card */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-mono">{challan.challan_number}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {TYPE_LABEL[challan.challan_type]} &middot;{" "}
              {new Date(challan.challan_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right space-y-1">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            <p className="text-xs text-muted-foreground">
              {challan.returnable_type === "returnable"
                ? "✅ Returnable"
                : "Non-returnable"}
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</p>
            <p className="text-sm font-medium mt-0.5">
              {challan.from_location?.name ?? challan.from_location_name ?? "—"}
            </p>
            {challan.from_location?.address && (
              <p className="text-xs text-muted-foreground">{challan.from_location.address}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
            <p className="text-sm font-medium mt-0.5">
              {challan.to_location?.name ?? challan.to_location_name ?? "—"}
            </p>
            {challan.to_location?.address && (
              <p className="text-xs text-muted-foreground">{challan.to_location.address}</p>
            )}
          </div>
          {challan.clients && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
              <p className="text-sm font-medium mt-0.5">{challan.clients.name}</p>
              {challan.clients.gstin && (
                <p className="text-xs text-muted-foreground font-mono">{challan.clients.gstin}</p>
              )}
            </div>
          )}
          {challan.vehicle_number && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle</p>
              <p className="text-sm font-medium font-mono mt-0.5">{challan.vehicle_number}</p>
            </div>
          )}
          {challan.driver_name && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver</p>
              <p className="text-sm mt-0.5">{challan.driver_name}</p>
            </div>
          )}
          {challan.transporter_name && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transporter</p>
              <p className="text-sm mt-0.5">{challan.transporter_name}</p>
            </div>
          )}
          {challan.eway_bill_number && (
            <div className="col-span-2 sm:col-span-3 bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">e-Way Bill</p>
              <p className="text-base font-bold font-mono text-blue-800 mt-0.5">{challan.eway_bill_number}</p>
              {challan.eway_bill_valid_until && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Valid until: {new Date(challan.eway_bill_valid_until).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">#</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">Description</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">HSN / SAC</th>
                <th className="text-right py-2 font-medium text-muted-foreground text-xs uppercase">Qty</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase pl-2">Unit</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase pl-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, i) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{item.description}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{item.hsn_sac_code || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 pl-2 text-muted-foreground">{item.unit}</td>
                  <td className="py-2 pl-2 text-muted-foreground text-xs">{item.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {challan.notes && (
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{challan.notes}</p>
          </div>
        )}

        {/* Timeline */}
        {(challan.dispatched_at || challan.received_at || challan.returned_at) && (
          <div className="px-5 pb-5 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Timeline</p>
            <div className="space-y-1 text-sm">
              {challan.dispatched_at && (
                <p>📤 Dispatched: {new Date(challan.dispatched_at).toLocaleString("en-IN")}</p>
              )}
              {challan.received_at && (
                <p>📥 Received: {new Date(challan.received_at).toLocaleString("en-IN")}</p>
              )}
              {challan.returned_at && (
                <p>🔄 Returned: {new Date(challan.returned_at).toLocaleString("en-IN")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* E-Way Bill Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            e-Way Bill
            {challan.eway_bill_number && (
              <span className="text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-mono">
                {challan.eway_bill_number}
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Transport Mode</Label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="rail">Rail</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="ship">Ship / Water</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (km)</Label>
              <Input
                type="number" min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transporter GSTIN (optional)</Label>
              <Input
                value={transporterGstin}
                onChange={(e) => setTransporterGstin(e.target.value.toUpperCase())}
                placeholder="29AAAAA0000A1Z5"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={saveEWB} disabled={ewbSaving}>
              {ewbSaving ? "Saving…" : "Save Transport Details"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              After uploading to portal
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">e-Way Bill Number</Label>
                <Input
                  value={ewbNumber}
                  onChange={(e) => setEwbNumber(e.target.value)}
                  placeholder="331234567890"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valid Until</Label>
                <Input
                  type="date"
                  value={ewbValidUntil}
                  onChange={(e) => setEwbValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={saveEWB} disabled={ewbSaving}>
                {ewbSaving ? "Saving…" : "Save e-Way Bill Number"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ChallanDetail = {
  id: string;
  challan_number: string;
  challan_date: string;
  challan_type: "delivery" | "job_work" | "return";
  returnable_type: "returnable" | "non_returnable";
  status: "draft" | "dispatched" | "received" | "returned";
  from_location_name: string | null;
  to_location_name: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  transporter_name: string | null;
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  returned_at: string | null;
  clients: {
    id: string; name: string; gstin: string | null;
    address: string | null; city: string | null; state_code: string;
  } | null;
  from_location: { id: string; name: string; type: string; address: string | null } | null;
  to_location: { id: string; name: string; type: string; address: string | null } | null;
  challan_items: {
    id: string; description: string; hsn_sac_code: string;
    quantity: number; unit: string; remarks: string | null; sort_order: number;
  }[];
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:      { color: "bg-gray-100 text-gray-600",          label: "Draft" },
  dispatched: { color: "bg-blue-100 text-blue-700",          label: "Dispatched" },
  received:   { color: "bg-emerald-100 text-emerald-700",    label: "Received" },
  returned:   { color: "bg-violet-100 text-violet-700",      label: "Returned" },
};

const TYPE_LABEL: Record<string, string> = {
  delivery: "Delivery Challan",
  job_work: "Job Work Challan",
  return:   "Return Challan",
};

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  draft:      [{ label: "Mark as Dispatched", value: "dispatched" }],
  dispatched: [{ label: "Mark as Received", value: "received" }, { label: "Mark as Returned", value: "returned" }],
  received:   [{ label: "Mark as Returned",  value: "returned" }],
  returned:   [],
};

export default function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [challan, setChallan] = useState<ChallanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  async function fetchChallan() {
    setLoading(true);
    const res = await fetch(`/api/challans/${id}`);
    const json = await res.json();
    if (json.data) setChallan(json.data);
    else toast.error("Challan not found");
    setLoading(false);
  }

  useEffect(() => { fetchChallan(); }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/challans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success(`Challan marked as ${status}`); fetchChallan(); }
  }

  async function deleteChallan() {
    if (!confirm(`Delete challan ${challan?.challan_number}?`)) return;
    const res = await fetch(`/api/challans/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Challan deleted"); router.push("/dashboard/challans"); }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!challan) return <div className="p-6 text-sm text-red-500">Challan not found.</div>;

  const statusMeta = STATUS_META[challan.status];
  const nextActions = NEXT_STATUS[challan.status] ?? [];
  const sortedItems = [...challan.challan_items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/challans">← Challans</Link>
        </Button>
        <div className="flex-1" />
        {challan.status === "draft" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/challans/${id}/edit`}>Edit</Link>
          </Button>
        )}
        {nextActions.map((a) => (
          <Button key={a.value} size="sm" variant="outline" onClick={() => updateStatus(a.value)}>
            {a.label}
          </Button>
        ))}
        <Button size="sm" onClick={() => { setPrinting(true); setTimeout(() => window.print(), 300); }}>
          🖨 Print / PDF
        </Button>
        <Button variant="destructive" size="sm" onClick={deleteChallan}>Delete</Button>
      </div>

      {/* Challan Card */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-mono">{challan.challan_number}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {TYPE_LABEL[challan.challan_type]} &middot;{" "}
              {new Date(challan.challan_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right space-y-1">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            <p className="text-xs text-muted-foreground">
              {challan.returnable_type === "returnable"
                ? "✅ Returnable"
                : "Non-returnable"}
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</p>
            <p className="text-sm font-medium mt-0.5">
              {challan.from_location?.name ?? challan.from_location_name ?? "—"}
            </p>
            {challan.from_location?.address && (
              <p className="text-xs text-muted-foreground">{challan.from_location.address}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
            <p className="text-sm font-medium mt-0.5">
              {challan.to_location?.name ?? challan.to_location_name ?? "—"}
            </p>
            {challan.to_location?.address && (
              <p className="text-xs text-muted-foreground">{challan.to_location.address}</p>
            )}
          </div>
          {challan.clients && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
              <p className="text-sm font-medium mt-0.5">{challan.clients.name}</p>
              {challan.clients.gstin && (
                <p className="text-xs text-muted-foreground font-mono">{challan.clients.gstin}</p>
              )}
            </div>
          )}
          {challan.vehicle_number && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle</p>
              <p className="text-sm font-medium font-mono mt-0.5">{challan.vehicle_number}</p>
            </div>
          )}
          {challan.driver_name && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver</p>
              <p className="text-sm mt-0.5">{challan.driver_name}</p>
            </div>
          )}
          {challan.transporter_name && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transporter</p>
              <p className="text-sm mt-0.5">{challan.transporter_name}</p>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">#</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">Description</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">HSN / SAC</th>
                <th className="text-right py-2 font-medium text-muted-foreground text-xs uppercase">Qty</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase pl-2">Unit</th>
                <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase pl-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, i) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{item.description}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{item.hsn_sac_code || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 pl-2 text-muted-foreground">{item.unit}</td>
                  <td className="py-2 pl-2 text-muted-foreground text-xs">{item.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {challan.notes && (
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{challan.notes}</p>
          </div>
        )}

        {/* Timeline */}
        {(challan.dispatched_at || challan.received_at || challan.returned_at) && (
          <div className="px-5 pb-5 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Timeline</p>
            <div className="space-y-1 text-sm">
              {challan.dispatched_at && (
                <p>📤 Dispatched: {new Date(challan.dispatched_at).toLocaleString("en-IN")}</p>
              )}
              {challan.received_at && (
                <p>📥 Received: {new Date(challan.received_at).toLocaleString("en-IN")}</p>
              )}
              {challan.returned_at && (
                <p>🔄 Returned: {new Date(challan.returned_at).toLocaleString("en-IN")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print view rendered off-screen, shown only when printing */}
      <div className="hidden print:block">
        <ChallanPrintView challan={challan} />
      </div>
    </div>
  );
}
