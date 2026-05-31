"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { type Client } from "@/components/clients/ClientFormDialog";

type Branch = {
  id: string;
  client_id: string;
  label: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  pincode: string | null;
  is_active: boolean;
};

type BranchForm = {
  label: string;
  gstin: string;
  address: string;
  city: string;
  state_code: string;
  pincode: string;
};

const EMPTY_FORM: BranchForm = {
  label: "", gstin: "", address: "", city: "", state_code: "", pincode: "",
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = use(params);

  const [client, setClient] = useState<Client | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const [clientRes, branchRes] = await Promise.all([
      fetch(`/api/clients/${clientId}`),
      fetch(`/api/clients/${clientId}/branches`),
    ]);
    const [clientJson, branchJson] = await Promise.all([
      clientRes.json(),
      branchRes.json(),
    ]);
    if (clientJson.data) setClient(clientJson.data);
    if (branchJson.data) setBranches(branchJson.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [clientId]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setForm({
      label:      b.label,
      gstin:      b.gstin      ?? "",
      address:    b.address    ?? "",
      city:       b.city       ?? "",
      state_code: b.state_code ?? "",
      pincode:    b.pincode    ?? "",
    });
    setDialogOpen(true);
  }

  function set(field: keyof BranchForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editingId
        ? `/api/clients/${clientId}/branches/${editingId}`
        : `/api/clients/${clientId}/branches`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label:      form.label.trim(),
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
        toast.success(editingId ? "Branch updated" : "Branch added");
        setDialogOpen(false);
        const branchRes = await fetch(`/api/clients/${clientId}/branches`);
        const branchJson = await branchRes.json();
        if (branchJson.data) setBranches(branchJson.data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(bid: string, branchLabel: string) {
    if (!confirm(`Archive "${branchLabel}"? Existing EWB references are preserved.`)) return;
    const res = await fetch(`/api/clients/${clientId}/branches/${bid}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Branch archived"); setBranches((prev) => prev.filter((b) => b.id !== bid)); }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!client) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Client not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/clients">← Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const activeBranches = branches.filter((b) => b.is_active);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/clients">← Clients</Link>
        </Button>
        <h1 className="text-xl font-bold">{client.name}</h1>
        {client.gstin && (
          <Badge variant="outline" className="font-mono text-xs">{client.gstin}</Badge>
        )}
      </div>

      {/* Client summary */}
      <div className="border rounded-lg bg-white p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">State</p>
          <p className="mt-0.5">{client.state_code ? stateLabel(client.state_code) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">City</p>
          <p className="mt-0.5">{client.city ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Email</p>
          <p className="mt-0.5">{client.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Phone</p>
          <p className="mt-0.5">{client.phone ?? "—"}</p>
        </div>
        {client.address && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Address</p>
            <p className="mt-0.5">{client.address}</p>
          </div>
        )}
      </div>

      {/* Branches section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">GSTIN Branches</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Additional state registrations of this client. Used as the "Ship To" party on e-Way Bills.
            </p>
          </div>
          <Button size="sm" onClick={openAdd}>+ Add Branch</Button>
        </div>

        {activeBranches.length === 0 ? (
          <div className="border rounded-lg bg-white p-8 text-center space-y-2">
            <p className="text-sm font-medium">No branches added</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add a branch when this client has GST registrations in multiple states and you need to
              specify a different "Ship To" address on the e-Way Bill.
            </p>
            <Button size="sm" variant="outline" onClick={openAdd} className="mt-2">
              + Add first branch
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Branch Label</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>City / State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBranches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.label}</p>
                      {b.address && <p className="text-xs text-muted-foreground">{b.address}</p>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {b.gstin ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[b.city, b.state_code ? stateLabel(b.state_code) : null].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                        onClick={() => openEdit(b)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
                        onClick={() => handleArchive(b.id, b.label)}>
                        Archive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Branch" : `Add Branch — ${client.name}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Branch Label *</Label>
                <Input
                  value={form.label}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="e.g. Mumbai Branch, Rajasthan Depot"
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
                <p className="text-xs text-muted-foreground">Required for 4-party e-Way Bills.</p>
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
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
