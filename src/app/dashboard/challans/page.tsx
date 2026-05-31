"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Location = { id: string; name: string; type: string } | null;

type Challan = {
  id: string;
  challan_number: string;
  challan_date: string;
  challan_type: "delivery" | "job_work" | "return";
  returnable_type: "returnable" | "non_returnable";
  status: "draft" | "dispatched" | "received" | "returned";
  from_location_name: string | null;
  to_location_name: string | null;
  vehicle_number: string | null;
  notes: string | null;
  clients: { id: string; name: string } | null;
  from_location: Location;
  to_location: Location;
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:      { color: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",          label: "Draft" },
  dispatched: { color: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",          label: "Dispatched" },
  received:   { color: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", label: "Received" },
  returned:   { color: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",    label: "Returned" },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  delivery:  { label: "Delivery",  color: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  job_work:  { label: "Job Work",  color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  return:    { label: "Return",    color: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
};

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  draft:      [{ label: "Mark Dispatched", value: "dispatched" }],
  dispatched: [{ label: "Mark Received",   value: "received" }, { label: "Mark Returned", value: "returned" }],
  received:   [{ label: "Mark Returned",   value: "returned" }],
  returned:   [],
};

export default function ChallansPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch("/api/challans");
    const json = await res.json();
    if (json.data) setChallans(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/challans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success(`Challan marked as ${status}`); fetchAll(); }
  }

  async function deleteChallan(id: string, number: string) {
    if (!confirm(`Delete challan ${number}?`)) return;
    const res = await fetch(`/api/challans/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Challan deleted"); setChallans((prev) => prev.filter((c) => c.id !== id)); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Challans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track goods movement between warehouse and project sites
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/challans/locations">Manage Locations</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/challans/new">+ New Challan</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading challans…</p>
      ) : challans.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground text-sm">No challans yet.</p>
          <Button className="mt-3" asChild size="sm">
            <Link href="/dashboard/challans/new">Create your first challan</Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Challan #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Returnable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challans.map((c) => {
                const statusMeta = STATUS_META[c.status];
                const typeMeta = TYPE_META[c.challan_type];
                const nextActions = NEXT_STATUS[c.status] ?? [];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {c.challan_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(c.challan_date).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-inset ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {c.from_location?.name ?? c.from_location_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {c.to_location?.name ?? c.to_location_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.clients?.name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.returnable_type === "returnable"
                        ? <span className="text-emerald-600 font-medium text-xs">Returnable</span>
                        : <span className="text-gray-400 text-xs">Non-returnable</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-inset ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2">⋯</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/challans/${c.id}`}>View / Print</Link>
                          </DropdownMenuItem>
                          {c.status === "draft" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/challans/${c.id}/edit`}>Edit</Link>
                            </DropdownMenuItem>
                          )}
                          {nextActions.length > 0 && <DropdownMenuSeparator />}
                          {nextActions.map((a) => (
                            <DropdownMenuItem key={a.value} onClick={() => updateStatus(c.id, a.value)}>
                              {a.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => deleteChallan(c.id, c.challan_number)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
