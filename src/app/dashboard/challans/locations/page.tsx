"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Location = {
  id: string;
  name: string;
  type: "warehouse" | "project_site" | "other";
  address: string | null;
  is_active: boolean;
};

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  warehouse:    { label: "Warehouse",    color: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  project_site: { label: "Project Site", color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  other:        { label: "Other",        color: "bg-gray-100 text-gray-600 ring-1 ring-gray-200" },
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // New location form
  const [name, setName] = useState("");
  const [type, setType] = useState<"warehouse" | "project_site" | "other">("warehouse");
  const [address, setAddress] = useState("");
  const [adding, setAdding] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch("/api/locations");
    const json = await res.json();
    if (json.data) setLocations(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, address: address.trim() || null }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error.message);
      else {
        toast.success("Location added");
        setName(""); setAddress(""); setType("warehouse");
        fetchAll();
      }
    } finally {
      setAdding(false);
    }
  }

  async function removeLocation(id: string, locationName: string) {
    if (!confirm(`Archive location "${locationName}"? It won't appear in new challans but existing records are preserved.`)) return;
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Location archived"); setLocations((prev) => prev.filter((l) => l.id !== id)); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/challans">← Challans</Link>
        </Button>
        <h1 className="text-xl font-bold">Manage Locations</h1>
      </div>

      {/* Add Location Form */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="font-semibold text-sm">Add New Location</h2>
        <form onSubmit={addLocation} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Location Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Warehouse, Alpha Site" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="warehouse">Warehouse</option>
                <option value="project_site">Project Site</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address (optional)</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address or landmark" />
          </div>
          <Button type="submit" disabled={adding} size="sm">
            {adding ? "Adding…" : "Add Location"}
          </Button>
        </form>
      </div>

      {/* Locations Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No locations yet. Add one above.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => {
                const typeMeta = TYPE_LABEL[loc.type];
                return (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-inset ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loc.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm"
                        className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
                        onClick={() => removeLocation(loc.id, loc.name)}>
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
    </div>
  );
}
