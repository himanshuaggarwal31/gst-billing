"use client";

import { useState } from "react";
import { EWayBillSection } from "./EWayBillSection";
import { EInvoiceSection } from "./EInvoiceSection";

const TABS = [
  { id: "details",  label: "Details" },
  { id: "einvoice", label: "e-Invoice" },
  { id: "ewb",      label: "e-Way Bill" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function InvoiceDetailTabs({
  detailsContent,
  invoiceId,
}: {
  detailsContent: React.ReactNode;
  invoiceId: string;
}) {
  const [tab, setTab] = useState<TabId>("details");

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b flex">
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

      {/* Content */}
      <div className="pt-5">
        {tab === "details"  && <div className="space-y-6">{detailsContent}</div>}
        {tab === "einvoice" && <EInvoiceSection invoiceId={invoiceId} />}
        {tab === "ewb"      && <EWayBillSection apiBase={`/api/invoices/${invoiceId}`} />}
      </div>
    </div>
  );
}
