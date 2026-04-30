"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Expense = {
  id: string;
  vendor_name: string;
  expense_date: string;
  description: string | null;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  category: string;
  receipt_url: string | null;
};

const EXPENSE_CATEGORIES = [
  "General", "Rent", "Utilities", "Travel", "Office Supplies",
  "Marketing", "Software", "Professional Fees", "Salary", "Other",
];

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

const BLANK = {
  vendor_name: "", expense_date: new Date().toISOString().slice(0, 10),
  description: "", amount: "", gst_rate: "18", category: "General", receipt_url: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  async function fetchExpenses() {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      const json = await res.json();
      if (json.data) setExpenses(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchExpenses(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK, expense_date: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      vendor_name: e.vendor_name,
      expense_date: e.expense_date,
      description: e.description ?? "",
      amount: String(e.amount),
      gst_rate: String(e.gst_rate),
      category: e.category,
      receipt_url: e.receipt_url ?? "",
    });
    setOpen(true);
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        vendor_name: form.vendor_name,
        expense_date: form.expense_date,
        description: form.description || null,
        amount: parseFloat(form.amount),
        gst_rate: parseFloat(form.gst_rate),
        category: form.category,
        receipt_url: form.receipt_url || null,
      };
      const url = editing ? `/api/expenses/${editing.id}` : "/api/expenses";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to save");
      } else {
        setOpen(false);
        await fetchExpenses();
        toast.success(editing ? "Expense updated" : "Expense added");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Expense deleted");
    }
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const totalGst = expenses.reduce((s, e) => s + e.gst_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track business expenses and input GST credits.</p>
        </div>
        <Button onClick={openAdd}>+ Add Expense</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Input GST Credit</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">{fmt(totalGst)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total with GST</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalAmount + totalGst)}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-muted-foreground">No expenses recorded yet.</p>
          <Button className="mt-4" onClick={openAdd}>Add First Expense</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {new Date(e.expense_date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{e.vendor_name}</p>
                    {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5">
                      {e.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{fmt(e.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {e.gst_rate}% = {fmt(e.gst_amount)}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(e.total_amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}>Del</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vendor / Supplier *</Label>
                <Input value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} placeholder="Amazon AWS" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (excl. GST) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="1000" />
              </div>
              <div className="space-y-1.5">
                <Label>GST Rate %</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.gst_rate}
                  onChange={(e) => set("gst_rate", e.target.value)}
                >
                  {[0, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Monthly server cost" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.vendor_name || !form.amount}>
              {saving ? "Saving…" : editing ? "Update" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
