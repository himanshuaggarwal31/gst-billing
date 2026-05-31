"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { INDIAN_STATE_CODES, stateLabel } from "@/lib/gst";

type Supplier = {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  pincode: string | null;
  is_active: boolean;
};

type SupplierForm = {
  name: string;
  gstin: string;
  address: string;
  city: string;
  state_code: string;
  pincode: string;
};

const EMPTY_FORM: SupplierForm = {
  name: "", gstin: "", address: "", city: "", state_code: "", pincode: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch("/api/suppliers");
    const json = await res.json();
    if (json.data) setSuppliers(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name:       s.name,
      gstin:      s.gstin      ?? "",
      address:    s.address    ?? "",
      city:       s.city       ?? "",
      state_code: s.state_code ?? "",
      pincode:    s.pincode    ?? "",
    });
    setDialogOpen(true);
  }

  function set(field: keyof SupplierForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editingId ? `/api/suppliers/${editingId}` : "/api/suppliers";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       form.name.trim(),
          gstin:      form.gstin.trim()      || null,
          address:    form.address.trim()    || null,
          city:       form.city.trim()       || null,
          state_code: form.state_code        || null,
          pincode:    form.pincode.trim()    || null,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error.message);
      } else {
        toast.success(editingId ? "Supplier updated" : "Supplier added");
        setDialogOpen(false);
        fetchAll();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string, supplierName: string) {
    if (!confirm(`Archive "${supplierName}"? Existing e-Way Bill references are preserved.`)) return;
    const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Supplier archived"); setSuppliers((prev) => prev.filter((s) => s.id !== id)); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Used as "Dispatch From" party in e-Way Bills for triangular supply / drop-ship scenarios.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>+ Add Supplier</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suppliers.length === 0 ? (
        <div className="border rounded-lg bg-white p-10 text-center space-y-3">
          <p className="text-sm font-medium">No suppliers yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add a supplier when goods are dispatched directly from their premises to your customer
            (triangular supply). Their address will appear as "Dispatch From" on the e-Way Bill.
          </p>
          <Button size="sm" onClick={openAdd}>+ Add your first supplier</Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name / Address</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{s.name}</p>
                    {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.gstin ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[s.city, s.state_code ? stateLabel(s.state_code) : null].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                      onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
                      onClick={() => handleArchive(s.id, s.name)}>
                      Archive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Supplier Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Raj Steel Pvt Ltd"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  placeholder="27AABCU9603R1ZX"
                  maxLength={15}
                />
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                  placeholder="400093"
                  maxLength={6}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Plot 12, MIDC Industrial Area"
                />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Mumbai"
                />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Select value={form.state_code} onValueChange={(v) => set("state_code", v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDIAN_STATE_CODES).map(([code]) => (
                      <SelectItem key={code} value={code}>{stateLabel(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
