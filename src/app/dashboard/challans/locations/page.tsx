"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type Location = {
  id: string;
  name: string;
  type: "warehouse" | "project_site" | "other";
  address: string | null;
  gstin: string | null;
  city: string | null;
  state_code: string | null;
  pincode: string | null;
  is_active: boolean;
};

type LocationForm = {
  name: string;
  type: "warehouse" | "project_site" | "other";
  address: string;
  gstin: string;
  city: string;
  state_code: string;
  pincode: string;
};

const EMPTY_FORM: LocationForm = {
  name: "", type: "warehouse", address: "", gstin: "", city: "", state_code: "", pincode: "",
};

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  warehouse:    { label: "Warehouse",    color: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  project_site: { label: "Project Site", color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  other:        { label: "Other",        color: "bg-gray-100 text-gray-600 ring-1 ring-gray-200" },
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch("/api/locations");
    const json = await res.json();
    if (json.data) setLocations(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(loc: Location) {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      type: loc.type,
      address: loc.address ?? "",
      gstin: loc.gstin ?? "",
      city: loc.city ?? "",
      state_code: loc.state_code ?? "",
      pincode: loc.pincode ?? "",
    });
    setDialogOpen(true);
  }

  function set(field: keyof LocationForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editingId ? `/api/locations/${editingId}` : "/api/locations";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       form.name.trim(),
          type:       form.type,
          address:    form.address.trim()    || null,
          gstin:      form.gstin.trim()      || null,
          city:       form.city.trim()       || null,
          state_code: form.state_code        || null,
          pincode:    form.pincode.trim()    || null,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error.message);
      } else {
        toast.success(editingId ? "Location updated" : "Location added");
        setDialogOpen(false);
        fetchAll();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string, locationName: string) {
    if (!confirm(`Archive "${locationName}"? It won't appear in new challans but existing records are preserved.`)) return;
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Location archived"); setLocations((prev) => prev.filter((l) => l.id !== id)); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/challans">← Challans</Link>
          </Button>
          <h1 className="text-xl font-bold">Manage Locations</h1>
        </div>
        <Button size="sm" onClick={openAdd}>+ Add Location</Button>
      </div>

      {/* Locations Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : locations.length === 0 ? (
        <div className="border rounded-lg bg-white p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No locations yet.</p>
          <p className="text-xs text-muted-foreground">Locations are used as dispatch points in Delivery Challans and e-Way Bills.</p>
          <Button size="sm" onClick={openAdd}>+ Add your first location</Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => {
                const typeMeta = TYPE_LABEL[loc.type];
                return (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-inset ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {loc.gstin ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[loc.city, loc.state_code ? stateLabel(loc.state_code) : null].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                        onClick={() => openEdit(loc)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
                        onClick={() => handleArchive(loc.id, loc.name)}>
                        Archive
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Location Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Main Warehouse, Alpha Site"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="project_site">Project Site</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  placeholder="27AABCU9603R1ZX"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">Required for 4-party e-Way Bills.</p>
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
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                  placeholder="400093"
                  maxLength={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
