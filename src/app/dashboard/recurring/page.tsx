"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { INDIAN_STATE_CODES, GST_RATES } from "@/lib/gst";
import { Plus, Trash2, Play, Pencil, RefreshCw } from "lucide-react";

type Client = { id: string; name: string; state_code: string };
type LineItemRow = {
  description: string;
  hsn_sac_code: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  discount_percent: number;
};
type Template = {
  id: string;
  name: string;
  client_id: string;
  clients: { name: string } | null;
  frequency: "monthly" | "quarterly" | "yearly";
  next_run_date: string;
  last_run_date: string | null;
  invoice_number_prefix: string;
  notes: string | null;
  seller_state_code: string;
  line_items: LineItemRow[];
};

const emptyLine = (): LineItemRow => ({
  description: "",
  hsn_sac_code: "",
  quantity: 1,
  rate: 0,
  gst_rate: 18,
  discount_percent: 0,
});

const FREQ_LABEL = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

export default function RecurringPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [sellerStateCode, setSellerStateCode] = useState("27");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [nextRunDate, setNextRunDate] = useState("");
  const [prefix, setPrefix] = useState("REC-");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyLine()]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [tRes, cRes] = await Promise.all([
      fetch("/api/recurring"),
      fetch("/api/clients"),
    ]);
    const tData = await tRes.json();
    const cData = await cRes.json();
    if (tData.success) setTemplates(tData.data);
    if (cData.success) setClients(cData.data);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setName("");
    setClientId("");
    setSellerStateCode("27");
    setFrequency("monthly");
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    setNextRunDate(next.toISOString().split("T")[0]);
    setPrefix("REC-");
    setNotes("");
    setLineItems([emptyLine()]);
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    setName(t.name);
    setClientId(t.client_id);
    setSellerStateCode(t.seller_state_code);
    setFrequency(t.frequency);
    setNextRunDate(t.next_run_date);
    setPrefix(t.invoice_number_prefix);
    setNotes(t.notes ?? "");
    setLineItems(t.line_items?.length ? t.line_items : [emptyLine()]);
    setOpen(true);
  }

  async function handleSave() {
    if (!name || !clientId || !nextRunDate || lineItems.some((l) => !l.description || !l.rate)) return;
    setSaving(true);
    const payload = {
      name,
      client_id: clientId,
      seller_state_code: sellerStateCode,
      frequency,
      next_run_date: nextRunDate,
      invoice_number_prefix: prefix,
      notes: notes || null,
      line_items: lineItems,
    };
    const res = await fetch(editId ? `/api/recurring/${editId}` : "/api/recurring", {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      setOpen(false);
      fetchData();
    } else {
      alert(data.error?.message ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recurring template?")) return;
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function handleRun(id: string) {
    setRunningId(id);
    const res = await fetch(`/api/recurring/${id}`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      alert(`Invoice ${data.data.invoice_number} created!`);
      fetchData();
      router.refresh();
    } else {
      alert(data.error?.message ?? "Failed to generate invoice");
    }
    setRunningId(null);
  }

  function updateLine(index: number, field: keyof LineItemRow, value: string | number) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Set up templates to automatically generate invoices
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recurring templates yet. Create one to automate your invoices.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="secondary">{FREQ_LABEL[t.frequency]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.clients?.name ?? "Unknown client"}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next run</span>
                  <span className="font-medium">{t.next_run_date}</span>
                </div>
                {t.last_run_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last run</span>
                    <span>{t.last_run_date}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prefix</span>
                  <span>{t.invoice_number_prefix}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRun(t.id)}
                    disabled={runningId === t.id}
                  >
                    {runningId === t.id ? (
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "New"} Recurring Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Template Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Retainer" />
              </div>
              <div className="space-y-1">
                <Label>Invoice Prefix</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="REC-" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Seller State</Label>
                <Select value={sellerStateCode} onValueChange={setSellerStateCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDIAN_STATE_CODES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>{code} – {name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Next Run Date</Label>
                <Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes on invoice" />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Line Items</Label>
              {lineItems.map((li, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-end text-xs">
                  <div className="col-span-4 space-y-1">
                    {i === 0 && <Label className="text-xs">Description</Label>}
                    <Input
                      className="h-8 text-xs"
                      value={li.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Service / Product"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {i === 0 && <Label className="text-xs">HSN/SAC</Label>}
                    <Input
                      className="h-8 text-xs"
                      value={li.hsn_sac_code}
                      onChange={(e) => updateLine(i, "hsn_sac_code", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    {i === 0 && <Label className="text-xs">Qty</Label>}
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={li.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {i === 0 && <Label className="text-xs">Rate</Label>}
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={li.rate}
                      onChange={(e) => updateLine(i, "rate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    {i === 0 && <Label className="text-xs">GST%</Label>}
                    <Select
                      value={String(li.gst_rate)}
                      onValueChange={(v) => updateLine(i, "gst_rate", parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    {i === 0 && <Label className="text-xs">Disc%</Label>}
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={li.discount_percent}
                      onChange={(e) => updateLine(i, "discount_percent", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    {lineItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLineItems((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLineItems((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Line
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
