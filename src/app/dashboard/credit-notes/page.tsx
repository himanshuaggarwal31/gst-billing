"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import Link from "next/link";

type CreditNote = {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  reason: string;
  total_amount: number;
  clients: { name: string } | null;
  invoices: { invoice_number: string } | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

export default function CreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotes(); }, []);

  async function fetchNotes() {
    setLoading(true);
    const res = await fetch("/api/credit-notes");
    const json = await res.json();
    if (json.success) setNotes(json.data);
    setLoading(false);
  }

  async function handleDelete(id: string, number: string) {
    if (!confirm(`Delete credit note ${number}?`)) return;
    const res = await fetch(`/api/credit-notes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Deleted");
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } else {
      toast.error(json.error?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Notes</h1>
          <p className="text-sm text-muted-foreground">Issue credit notes against paid invoices</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/credit-notes/new">+ New Credit Note</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No credit notes yet. Issue one from a paid invoice.
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credit Note #</TableHead>
                <TableHead>Against Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((cn) => (
                <TableRow key={cn.id}>
                  <TableCell className="font-mono font-medium">{cn.credit_note_number}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {cn.invoices?.invoice_number ?? "—"}
                  </TableCell>
                  <TableCell>{cn.clients?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(cn.credit_note_date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{cn.reason}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(cn.total_amount)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(cn.id, cn.credit_note_number)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
