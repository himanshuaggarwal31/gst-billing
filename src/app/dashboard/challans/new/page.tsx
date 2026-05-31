"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Location = { id: string; name: string; type: string };
type Client = { id: string; name: string; state_code: string };
type Product = { id: string; name: string; hsn_sac_code: string };

type ItemForm = {
  product_id: string;
  description: string;
  hsn_sac_code: string;
  quantity: string;
  unit: string;
  remarks: string;
};

const UNITS = ["nos", "pcs", "kg", "mtr", "rmt", "set", "box", "ltr", "sqm", "sqft", "ton", "other"] as const;

const EMPTY_ITEM: ItemForm = {
  product_id: "",
  description: "",
  hsn_sac_code: "",
  quantity: "1",
  unit: "nos",
  remarks: "",
};

function ItemRow({
  item, idx, products, canRemove, onChange, onRemove,
}: {
  item: ItemForm;
  idx: number;
  products: Product[];
  canRemove: boolean;
  onChange: (idx: number, field: keyof ItemForm, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          {products.length > 0 && (
            catalogOpen ? (
              <div className="flex gap-2 items-center mb-1">
                <select
                  autoFocus
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const p = products.find((p) => p.id === e.target.value);
                    if (p) {
                      onChange(idx, "product_id", p.id);
                      onChange(idx, "description", p.name);
                      onChange(idx, "hsn_sac_code", p.hsn_sac_code);
                      setCatalogOpen(false);
                    }
                  }}
                >
                  <option value="" disabled>Select from catalog…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCatalogOpen(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium mb-1 flex items-center gap-1"
                onClick={() => setCatalogOpen(true)}>
                📦 Pick from catalog
              </button>
            )
          )}
          <Input
            value={item.description}
            onChange={(e) => onChange(idx, "description", e.target.value)}
            placeholder="Item / material description"
            required
          />
        </div>
        <div className="w-28 space-y-1 shrink-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">HSN / SAC</p>
          <Input
            value={item.hsn_sac_code}
            onChange={(e) => onChange(idx, "hsn_sac_code", e.target.value)}
            placeholder="720810"
            className="font-mono text-xs"
          />
        </div>
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)}
            className="mt-6 text-gray-300 hover:text-red-500 transition-colors text-xl leading-none shrink-0"
            title="Remove row">×</button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="w-28 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Quantity</p>
          <Input
            type="number" min="0.001" step="0.001"
            value={item.quantity}
            onChange={(e) => onChange(idx, "quantity", e.target.value)}
          />
        </div>
        <div className="w-28 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Unit</p>
          <select
            value={item.unit}
            onChange={(e) => onChange(idx, "unit", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Remarks</p>
          <Input
            value={item.remarks}
            onChange={(e) => onChange(idx, "remarks", e.target.value)}
            placeholder="Optional note for this item"
          />
        </div>
      </div>
    </div>
  );
}

export default function NewChallanPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Header fields
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [challanType, setChallanType] = useState<"delivery" | "job_work" | "return">("delivery");
  const [returnableType, setReturnableType] = useState<"returnable" | "non_returnable">("non_returnable");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [clientId, setClientId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }]);

  const loadData = useCallback(async () => {
    const [locRes, clientRes, prodRes, profileRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/clients"),
      fetch("/api/products"),
      fetch("/api/profile"),
    ]);
    const [locJson, clientJson, prodJson, profileJson] = await Promise.all([
      locRes.json(), clientRes.json(), prodRes.json(), profileRes.json(),
    ]);
    if (locJson.data) setLocations(locJson.data);
    if (clientJson.data) setClients(clientJson.data);
    if (prodJson.data) setProducts(prodJson.data);

    // Auto-generate challan number
    if (profileJson.data) {
      const prefix = profileJson.data.challan_prefix ?? "DCH-";
      const res = await fetch("/api/challans");
      const json = await res.json();
      const count = (json.data?.length ?? 0) + 1;
      setChallanNumber(`${prefix}${String(count).padStart(3, "0")}`);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function changeItem(idx: number, field: keyof ItemForm, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }
  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challanNumber.trim()) { toast.error("Challan number is required"); return; }
    if (!fromLocationId && !toLocationId) {
      toast.error("Select at least one location (from or to)");
      return;
    }
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challan_number: challanNumber,
          challan_date: challanDate,
          challan_type: challanType,
          returnable_type: returnableType,
          from_location_id: fromLocationId || null,
          to_location_id: toLocationId || null,
          client_id: clientId || null,
          vehicle_number: vehicleNumber || null,
          driver_name: driverName || null,
          transporter_name: transporterName || null,
          notes: notes || null,
          items: validItems.map((it) => ({
            product_id: it.product_id || null,
            description: it.description,
            hsn_sac_code: it.hsn_sac_code,
            quantity: parseFloat(it.quantity) || 1,
            unit: it.unit,
            remarks: it.remarks || null,
          })),
        }),
      });
      const json = await res.json();
      if (json.error) { toast.error(json.error.message); return; }
      toast.success("Challan created");
      router.push(`/dashboard/challans/${json.data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const warehouseLocations = locations.filter((l) => l.type === "warehouse");
  const siteLocations = locations.filter((l) => l.type === "project_site");
  const otherLocations = locations.filter((l) => l.type === "other");

  function renderLocationOptions() {
    return (
      <>
        <option value="">— Select location —</option>
        {warehouseLocations.length > 0 && (
          <optgroup label="Warehouses">
            {warehouseLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </optgroup>
        )}
        {siteLocations.length > 0 && (
          <optgroup label="Project Sites">
            {siteLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </optgroup>
        )}
        {otherLocations.length > 0 && (
          <optgroup label="Other">
            {otherLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </optgroup>
        )}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/challans">← Back</Link>
        </Button>
        <h1 className="text-xl font-bold">New Delivery Challan</h1>
      </div>

      {locations.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No locations found.{" "}
          <Link href="/dashboard/challans/locations" className="underline font-medium">
            Add locations first
          </Link>{" "}
          (e.g. Main Warehouse, Project Alpha Site).
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Challan Header */}
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Challan Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="challan_number">Challan Number *</Label>
              <Input id="challan_number" value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="challan_date">Date *</Label>
              <Input id="challan_date" type="date" value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Challan Type</Label>
              <select value={challanType}
                onChange={(e) => setChallanType(e.target.value as typeof challanType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="delivery">Delivery Challan</option>
                <option value="job_work">Job Work Challan</option>
                <option value="return">Return Challan</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Returnable?</Label>
              <select value={returnableType}
                onChange={(e) => setReturnableType(e.target.value as typeof returnableType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="non_returnable">Non-Returnable</option>
                <option value="returnable">Returnable (goods expected back)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Movement */}
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Movement</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>From Location</Label>
              <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {renderLocationOptions()}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To Location</Label>
              <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {renderLocationOptions()}
              </select>
            </div>
          </div>

          {clients.length > 0 && (
            <div className="space-y-1">
              <Label>Client / Vendor (optional)</Label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Transport Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Vehicle Number</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="MH 12 AB 1234" />
            </div>
            <div className="space-y-1">
              <Label>Driver Name</Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)}
                placeholder="Driver name" />
            </div>
            <div className="space-y-1">
              <Label>Transporter</Label>
              <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)}
                placeholder="Transporter name" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Items</h2>
            <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <ItemRow
                key={idx} item={item} idx={idx}
                products={products} canRemove={items.length > 1}
                onChange={changeItem} onRemove={removeItem}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
            + Add Item
          </Button>
        </div>

        {/* Notes */}
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any delivery instructions or remarks…" rows={2} />
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" asChild>
            <Link href="/dashboard/challans">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Challan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
