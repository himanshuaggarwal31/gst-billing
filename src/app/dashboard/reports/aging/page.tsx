"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "over_90";

type AgingRow = {
  client_id: string;
  client_name: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
  bucket: AgingBucket;
};

type BucketTotals = Record<AgingBucket, { count: number; amount: number }>;

type AgingReport = {
  rows: AgingRow[];
  bucketTotals: BucketTotals;
  totalOutstanding: number;
  asOf: string;
};

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current (not yet due)",
  "1_30":  "1–30 days overdue",
  "31_60": "31–60 days overdue",
  "61_90": "61–90 days overdue",
  over_90: "Over 90 days overdue",
};

const BUCKET_COLORS: Record<AgingBucket, string> = {
  current: "bg-emerald-100 text-emerald-700",
  "1_30":  "bg-amber-100 text-amber-700",
  "31_60": "bg-orange-100 text-orange-700",
  "61_90": "bg-red-100 text-red-700",
  over_90: "bg-red-200 text-red-900 font-semibold",
};

const BUCKET_BAR_COLORS: Record<AgingBucket, string> = {
  current: "bg-emerald-400",
  "1_30":  "bg-amber-400",
  "31_60": "bg-orange-500",
  "61_90": "bg-red-500",
  over_90: "bg-red-800",
};

const BUCKETS: AgingBucket[] = ["current", "1_30", "31_60", "61_90", "over_90"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

export default function AgingReportPage() {
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterBucket, setFilterBucket] = useState<AgingBucket | "all">("all");

  useEffect(() => {
    fetch("/api/reports/aging")
      .then((r) => r.json())
      .then((j) => { if (j.data) setReport(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground p-6">Loading aging report…</p>;
  if (!report) return <p className="text-sm text-muted-foreground p-6">Failed to load report.</p>;

  const { rows, bucketTotals, totalOutstanding, asOf } = report;
  const filteredRows = filterBucket === "all" ? rows : rows.filter((r) => r.bucket === filterBucket);

  const overdueTotal =
    bucketTotals["1_30"].amount +
    bucketTotals["31_60"].amount +
    bucketTotals["61_90"].amount +
    bucketTotals.over_90.amount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aging Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outstanding receivables by how long they have been overdue. As of {asOf}.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {BUCKETS.map((bucket) => {
          const bt = bucketTotals[bucket];
          const pct = totalOutstanding > 0 ? (bt.amount / totalOutstanding) * 100 : 0;
          return (
            <button
              key={bucket}
              onClick={() => setFilterBucket(filterBucket === bucket ? "all" : bucket)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                filterBucket === bucket ? "ring-2 ring-offset-1 ring-blue-500" : ""
              }`}
            >
              <p className="text-xs text-muted-foreground">{BUCKET_LABELS[bucket]}</p>
              <p className="text-xl font-bold mt-1">{fmt(bt.amount)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bt.count} invoice{bt.count !== 1 ? "s" : ""}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BUCKET_BAR_COLORS[bucket]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Total outstanding + overdue alert */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-lg bg-gray-900 text-white px-5 py-3">
          <p className="text-xs opacity-70">Total Outstanding</p>
          <p className="text-2xl font-bold">{fmt(totalOutstanding)}</p>
        </div>
        {overdueTotal > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-5 py-3">
            <p className="text-xs text-red-500">Overdue (past due date)</p>
            <p className="text-2xl font-bold text-red-700">{fmt(overdueTotal)}</p>
          </div>
        )}
        {filterBucket !== "all" && (
          <Button variant="outline" size="sm" onClick={() => setFilterBucket("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Invoice table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filterBucket === "all"
              ? `All outstanding invoices (${rows.length})`
              : `${BUCKET_LABELS[filterBucket]} (${filteredRows.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              {rows.length === 0 ? "No outstanding invoices. All caught up!" : "No invoices in this bucket."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-muted-foreground">
                    <th className="py-2.5 px-4 text-left">Client</th>
                    <th className="py-2.5 px-4 text-left">Invoice #</th>
                    <th className="py-2.5 px-4 text-left">Invoice Date</th>
                    <th className="py-2.5 px-4 text-left">Due Date</th>
                    <th className="py-2.5 px-4 text-right">Invoice Amt</th>
                    <th className="py-2.5 px-4 text-right">Paid</th>
                    <th className="py-2.5 px-4 text-right">Outstanding</th>
                    <th className="py-2.5 px-4 text-center">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.invoice_id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium">{row.client_name}</td>
                      <td className="py-2.5 px-4 font-mono text-xs">{row.invoice_number}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{row.invoice_date}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {row.due_date ?? <span className="italic">no due date</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right">{fmt(row.total_amount)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600">
                        {row.amount_paid > 0 ? fmt(row.amount_paid) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-red-600">
                        {fmt(row.outstanding)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge className={`text-xs ${BUCKET_COLORS[row.bucket]}`}>
                          {row.bucket === "current"
                            ? "Current"
                            : `${row.days_overdue}d overdue`}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-gray-50">
                    <td className="py-2.5 px-4" colSpan={6}>
                      {filterBucket === "all" ? "Total outstanding" : `Subtotal (${BUCKET_LABELS[filterBucket]})`}
                    </td>
                    <td className="py-2.5 px-4 text-right text-red-600">
                      {fmt(filteredRows.reduce((s, r) => s + r.outstanding, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
