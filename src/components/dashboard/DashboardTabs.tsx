"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG } from "@/lib/plan-config";

type Props = {
  businessName: string;
  plan: string;
  invoiceCountThisMonth: number;
  totalBilled: string;
  totalGst: string;
  totalPending: string;
  isNearLimit: boolean;
  freeLimit: number;
};

const TABS = [
  { id: "home",     label: "Home" },
  { id: "overview", label: "Overview" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DashboardTabs({
  businessName,
  plan,
  invoiceCountThisMonth,
  totalBilled,
  totalGst,
  totalPending,
  isNearLimit,
  freeLimit,
}: Props) {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b flex mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Home tab */}
      {tab === "home" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{businessName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={plan === "free" ? "secondary" : "default"} className="capitalize">
                {plan} plan
              </Badge>
              {plan === "free" && (
                <span className="text-sm text-muted-foreground">
                  {invoiceCountThisMonth} / {freeLimit} invoices this month
                </span>
              )}
            </div>
          </div>

          {isNearLimit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-amber-800">
                You&apos;ve used {invoiceCountThisMonth}/{freeLimit} free invoices this month.
              </p>
              <Link href="/dashboard/billing">
                <Button size="sm" variant="outline">Upgrade Plan</Button>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/dashboard/invoices/new">
              <Button className="w-full">+ New Invoice</Button>
            </Link>
            <Link href="/dashboard/invoices">
              <Button variant="outline" className="w-full">View Invoices</Button>
            </Link>
            <Link href="/dashboard/clients">
              <Button variant="outline" className="w-full">Manage Clients</Button>
            </Link>
            <Link href="/dashboard/quotations/new">
              <Button variant="outline" className="w-full">+ New Quotation</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {isNearLimit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-amber-800">
                You&apos;ve used {invoiceCountThisMonth}/{freeLimit} free invoices this month.
              </p>
              <Link href="/dashboard/billing">
                <Button size="sm" variant="outline">Upgrade Plan</Button>
              </Link>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-medium text-muted-foreground">Total Billed</p>
              <p className="text-2xl font-bold mt-1">{totalBilled}</p>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-medium text-muted-foreground">GST Collected</p>
              <p className="text-2xl font-bold mt-1">{totalGst}</p>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{totalPending}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/invoices">
              <Button variant="outline">View All Invoices</Button>
            </Link>
            <Link href="/dashboard/clients">
              <Button variant="outline">Manage Clients</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
