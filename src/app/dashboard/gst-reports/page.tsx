"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MonthOption = { value: string; label: string };

type ItcRow = {
  month: string;
  label: string;
  gstCollected: number;
  gstPaid: number;
  netPayable: number;
};

type GstSummary = {
  collected: number;
  paid: number;
  net: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function getLast12Months(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

export default function GstReportsPage() {
  const months = getLast12Months();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [downloading, setDownloading] = useState<"gstr1" | "gstr3b" | null>(null);
  const [itcData, setItcData] = useState<ItcRow[]>([]);
  const [summary, setSummary] = useState<GstSummary | null>(null);
  const [loadingItc, setLoadingItc] = useState(true);

  useEffect(() => {
    setLoadingItc(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) return;
        const rows: ItcRow[] = (j.data.monthly ?? []).map(
          (m: { month: string; label: string; gst: number; expenses: number }) => ({
            month: m.month,
            label: m.label,
            gstCollected: m.gst ?? 0,
            // expenses gst approximation: analytics returns total expense, we need gst portion
            // We'll refine this via a dedicated ITC call; for now use gst field from analytics
            gstPaid: 0, // filled below
            netPayable: 0,
          })
        );

        const gs: GstSummary = j.data.gstSummary ?? { collected: 0, paid: 0, net: 0 };
        setSummary(gs);

        // Enrich with expense gst data from the analytics summary
        // analytics gstSummary.paid is the total ITC; distribute evenly for now
        // (a dedicated ITC endpoint could give per-month data)
        const totalCollected = rows.reduce((s, r) => s + r.gstCollected, 0);
        for (const row of rows) {
          const share = totalCollected > 0 ? row.gstCollected / totalCollected : 0;
          row.gstPaid = gs.paid * share;
          row.netPayable = Math.max(0, row.gstCollected - row.gstPaid);
        }

        setItcData(rows);
      })
      .finally(() => setLoadingItc(false));
  }, []);

  async function download(type: "gstr1" | "gstr3b") {
    setDownloading(type);
    try {
      const url =
        type === "gstr1"
          ? `/api/gstr1?month=${selectedMonth}`
          : `/api/gstr3b?month=${selectedMonth}`;
      const res = await fetch(url);
      if (!res.ok) {
        alert("Failed to generate report. Please try again.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `${type.toUpperCase()}_${selectedMonth}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(null);
    }
  }

  const selectedLabel = months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth;
  const cumulativeNet = itcData.reduce((s, r) => s + r.netPayable, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GST Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export GSTR-1 and GSTR-3B returns. View your Input Tax Credit (ITC) ledger.
        </p>
      </div>

      {/* Month selector + Export buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Returns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-48"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => download("gstr1")}
                disabled={!!downloading}
              >
                {downloading === "gstr1" ? "Generating…" : `⬇ GSTR-1 — ${selectedLabel}`}
              </Button>
              <Button
                onClick={() => download("gstr3b")}
                disabled={!!downloading}
              >
                {downloading === "gstr3b" ? "Generating…" : `⬇ GSTR-3B — ${selectedLabel}`}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm text-muted-foreground">
            <div className="rounded-lg bg-gray-50 p-3 border">
              <p className="font-semibold text-gray-700 mb-1">GSTR-1</p>
              <p>Outward supplies return — B2B (registered buyers) and B2C (unregistered). Upload to the GST portal or hand to your accountant.</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border">
              <p className="font-semibold text-gray-700 mb-1">GSTR-3B</p>
              <p>Monthly consolidated return — output tax, ITC from expenses, and net payable. Required for every GST-registered business.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">GST Collected (all time)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-gray-900">{fmt(summary.collected)}</p>
              <p className="text-xs text-muted-foreground">Output tax on invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">ITC Available (all time)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-blue-600">{fmt(summary.paid)}</p>
              <p className="text-xs text-muted-foreground">GST paid on purchases</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Net GST Payable (all time)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-red-600">{fmt(summary.net)}</p>
              <p className="text-xs text-muted-foreground">Collected − ITC</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Estimated Net Payable (12 mo)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-orange-600">{fmt(cumulativeNet)}</p>
              <p className="text-xs text-muted-foreground">After ITC adjustment</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ITC Ledger table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ITC Ledger — Monthly Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            GST collected on your invoices vs GST paid on expenses (Input Tax Credit). You only remit the difference to the government.
          </p>
        </CardHeader>
        <CardContent>
          {loadingItc ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : itcData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet. Create invoices and log expenses to see the ITC ledger.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-muted-foreground">
                    <th className="py-2 px-3 text-left">Month</th>
                    <th className="py-2 px-3 text-right">GST Collected</th>
                    <th className="py-2 px-3 text-right">ITC (GST Paid)</th>
                    <th className="py-2 px-3 text-right">Net Payable</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itcData.map((row) => (
                    <tr key={row.month} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium">{row.label}</td>
                      <td className="py-2.5 px-3 text-right text-gray-900">{fmt(row.gstCollected)}</td>
                      <td className="py-2.5 px-3 text-right text-blue-600">{fmt(row.gstPaid)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        <span className={row.netPayable > 0 ? "text-red-600" : "text-green-600"}>
                          {fmt(row.netPayable)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.gstCollected === 0 ? (
                          <Badge variant="secondary" className="text-xs">No invoices</Badge>
                        ) : row.netPayable <= 0 ? (
                          <Badge className="text-xs bg-green-100 text-green-700">ITC covers all</Badge>
                        ) : (
                          <Badge className="text-xs bg-amber-100 text-amber-700">Payable</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-gray-50">
                    <td className="py-2.5 px-3">Total (12 months)</td>
                    <td className="py-2.5 px-3 text-right">{fmt(itcData.reduce((s, r) => s + r.gstCollected, 0))}</td>
                    <td className="py-2.5 px-3 text-right text-blue-600">{fmt(itcData.reduce((s, r) => s + r.gstPaid, 0))}</td>
                    <td className="py-2.5 px-3 text-right text-red-600">{fmt(cumulativeNet)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * ITC distribution across months is estimated proportionally. For precise per-month ITC, ensure expenses are dated correctly.
        Always verify exported data with your CA before filing on the GST portal.
      </p>
    </div>
  );
}
