"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Analytics = {
  monthly: { month: string; label: string; revenue: number; gst: number; expenses: number }[];
  topClients: { name: string; total: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  gstSummary: { collected: number; paid: number; net: number; taxable: number };
  totals: { invoices: number; revenue: number; expenses: number; clients: number };
};

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a", pending: "#d97706", partial: "#2563eb", draft: "#6b7280", overdue: "#dc2626",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground p-6">Loading analytics…</p>;
  if (!data) return <p className="text-sm text-muted-foreground p-6">Failed to load analytics.</p>;

  const { monthly, topClients, statusBreakdown, gstSummary, totals } = data;
  const maxClientTotal = Math.max(...topClients.map((c) => c.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Revenue, GST liability, and business insights.</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>+ New Invoice</Button>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={fmt(totals.revenue)} sub={`${totals.invoices} invoices`} />
        <StatCard label="Total Expenses" value={fmt(totals.expenses)} />
        <StatCard label="GST Collected" value={fmt(gstSummary.collected)} sub="From clients" color="text-blue-700" />
        <StatCard label="Net GST Payable" value={fmt(gstSummary.net)} sub={`Paid: ${fmt(gstSummary.paid)}`} color={gstSummary.net > 0 ? "text-red-600" : "text-green-600"} />
      </div>

      {/* Monthly revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue vs Expenses (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#1a56db" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="gst" name="GST" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {topClients.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate max-w-[60%]">{c.name}</span>
                      <span className="text-muted-foreground">{fmt(c.total)} ({c.count} inv)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${(c.total / maxClientTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice status pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <PieChart width={260} height={220}>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) => `${props.status}: ${props.count}`}
                  labelLine={false}
                >
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GST summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Liability Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Taxable Turnover</p>
              <p className="text-lg font-bold mt-0.5">{fmt(gstSummary.taxable)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">GST Collected (Output)</p>
              <p className="text-lg font-bold mt-0.5 text-blue-700">{fmt(gstSummary.collected)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">GST Paid on Purchases (Input)</p>
              <p className="text-lg font-bold mt-0.5 text-green-700">{fmt(gstSummary.paid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Net GST Payable</p>
              <p className={`text-lg font-bold mt-0.5 ${gstSummary.net > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(gstSummary.net)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
