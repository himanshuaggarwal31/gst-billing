"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import ClientFormDialog, { type Client } from "@/components/clients/ClientFormDialog";

type StatementData = {
  client: { name: string; gstin: string | null; email: string | null };
  invoices: Array<{
    id: string; invoice_number: string; invoice_date: string;
    due_date: string | null; total_amount: number; payment_status: string;
  }>;
  payments: Array<{
    invoice_id: string; amount: number; payment_date: string; method: string;
  }>;
  creditNotes: Array<{
    id: string; credit_note_number: string; credit_note_date: string;
    total_amount: number; reason: string;
  }>;
  summary: {
    totalBilled: number; totalPaid: number; totalCredits: number; balance: number;
  };
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function StatementModal({
  clientId, open, onClose,
}: { clientId: string | null; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/clients/${clientId}/statement`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); })
      .finally(() => setLoading(false));
  }, [open, clientId]);

  // Build a chronological timeline
  type TxEntry = { date: string; label: string; debit: number; credit: number; type: string };
  const timeline: TxEntry[] = [];
  if (data) {
    for (const inv of data.invoices) {
      timeline.push({
        date: inv.invoice_date,
        label: `Invoice ${inv.invoice_number}`,
        debit: inv.total_amount,
        credit: 0,
        type: "invoice",
      });
    }
    for (const p of data.payments) {
      const inv = data.invoices.find((i) => i.id === p.invoice_id);
      timeline.push({
        date: p.payment_date,
        label: `Payment — ${p.method.replace("_", " ")}${inv ? ` (Inv ${inv.invoice_number})` : ""}`,
        debit: 0,
        credit: p.amount,
        type: "payment",
      });
    }
    for (const cn of data.creditNotes) {
      timeline.push({
        date: cn.credit_note_date,
        label: `Credit Note ${cn.credit_note_number} — ${cn.reason}`,
        debit: 0,
        credit: cn.total_amount,
        type: "credit",
      });
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statement of Account — {data?.client.name ?? "…"}</DialogTitle>
          <DialogDescription>
            Full transaction history including invoices, payments, and credit notes.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>}

        {data && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: "Total Billed", value: data.summary.totalBilled, color: "text-gray-900" },
                { label: "Total Paid", value: data.summary.totalPaid, color: "text-emerald-600" },
                { label: "Credits", value: data.summary.totalCredits, color: "text-blue-600" },
                {
                  label: "Balance Due",
                  value: data.summary.balance,
                  color: data.summary.balance > 0 ? "text-red-600" : "text-emerald-600",
                },
              ] as const).map((card) => (
                <div key={card.label} className="rounded-lg bg-gray-50 border p-3 text-center">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-base font-bold mt-0.5 ${card.color}`}>{fmt(Number(card.value))}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-muted-foreground">
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Billed (Dr)</th>
                    <th className="py-2 text-right">Received (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
                      <td className="py-2">
                        <span className={`text-xs mr-2 px-1.5 py-0.5 rounded font-medium ${
                          row.type === "invoice" ? "bg-amber-100 text-amber-700" :
                          row.type === "payment" ? "bg-emerald-100 text-emerald-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {row.type === "invoice" ? "INV" : row.type === "payment" ? "PMT" : "CN"}
                        </span>
                        {row.label}
                      </td>
                      <td className="py-2 text-right">{row.debit > 0 ? fmt(row.debit) : "—"}</td>
                      <td className="py-2 text-right text-emerald-600">
                        {row.credit > 0 ? fmt(row.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-gray-50">
                    <td className="py-2 px-0" colSpan={2}>Balance Due</td>
                    <td className="py-2 text-right">{fmt(data.summary.totalBilled)}</td>
                    <td className={`py-2 text-right ${
                      data.summary.balance <= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {fmt(data.summary.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [statementClientId, setStatementClientId] = useState<string | null>(null);

  async function fetchClients() {
    setLoading(true);
    const res = await fetch("/api/clients");
    const json = await res.json();
    if (json.data) setClients(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchClients(); }, []);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setDialogOpen(true);
  }

  function handleSaved(saved: Client) {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) {
      toast.error(json.error.message);
    } else {
      toast.success("Client deleted");
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Client</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No clients yet.</p>
          <Button className="mt-4" onClick={openAdd}>
            Add your first client
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {client.gstin ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {client.gstin}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{client.state_code}</TableCell>
                  <TableCell className="text-sm">{client.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{client.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link href={`/dashboard/clients/${client.id}`}>Branches</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatementClientId(client.id)}
                      >
                        Statement
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(client)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(client)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientFormDialog
        open={dialogOpen}
        client={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <StatementModal
        clientId={statementClientId}
        open={!!statementClientId}
        onClose={() => setStatementClientId(null)}
      />
    </div>
  );
}
