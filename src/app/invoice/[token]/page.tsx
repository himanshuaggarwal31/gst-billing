import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STATE_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
  "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala",
  "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
};

function fmt(n: number) {
  return `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/invoice/${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) notFound();

  const { invoice, profile } = await res.json();

  const lines = [...invoice.invoice_line_items].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  );

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
    sent: { label: "Sent", cls: "bg-blue-100 text-blue-700" },
    paid: { label: "Paid", cls: "bg-green-100 text-green-700" },
    overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
  };
  const status = STATUS_MAP[invoice.payment_status] ?? STATUS_MAP.draft;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Header */}
        <div className="bg-blue-700 text-white px-8 py-6 flex justify-between items-start">
          <div>
            {profile?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="logo" className="h-10 object-contain mb-3" />
            )}
            <h1 className="text-xl font-bold">{profile?.business_name ?? "Business"}</h1>
            {profile?.gstin && <p className="text-blue-200 text-sm">GSTIN: {profile.gstin}</p>}
            {profile?.address && <p className="text-blue-100 text-sm mt-0.5">{profile.address}</p>}
            {profile?.city && <p className="text-blue-100 text-sm">{profile.city}{profile.state_code ? `, ${STATE_NAMES[profile.state_code] ?? profile.state_code}` : ""} {profile.pincode ?? ""}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tracking-tight">TAX INVOICE</p>
            <p className="text-blue-200 text-sm mt-1">#{invoice.invoice_number}</p>
            <p className="text-blue-100 text-sm">{fmtDate(invoice.invoice_date)}</p>
            {invoice.due_date && (
              <p className="text-blue-100 text-sm">Due: {fmtDate(invoice.due_date)}</p>
            )}
            <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="text-xs uppercase text-gray-400 font-medium mb-2 tracking-wide">Bill From</p>
              <p className="font-semibold text-gray-900">{profile?.business_name ?? "—"}</p>
              {profile?.gstin && <p className="text-gray-500">GSTIN: {profile.gstin}</p>}
              {profile?.pan && <p className="text-gray-500">PAN: {profile.pan}</p>}
              {profile?.phone && <p className="text-gray-500">{profile.phone}</p>}
              {profile?.email && <p className="text-gray-500">{profile.email}</p>}
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="text-xs uppercase text-gray-400 font-medium mb-2 tracking-wide">Bill To</p>
              <p className="font-semibold text-gray-900">{invoice.clients?.name ?? "—"}</p>
              {invoice.clients?.gstin && <p className="text-gray-500">GSTIN: {invoice.clients.gstin}</p>}
              {invoice.clients?.address && <p className="text-gray-500">{invoice.clients.address}</p>}
              {invoice.clients?.city && (
                <p className="text-gray-500">
                  {invoice.clients.city}{invoice.clients.state_code ? `, ${STATE_NAMES[invoice.clients.state_code] ?? invoice.clients.state_code}` : ""} {invoice.clients.pincode ?? ""}
                </p>
              )}
              {invoice.clients?.email && <p className="text-gray-500">{invoice.clients.email}</p>}
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                  <th className="text-left px-3 py-2 rounded-tl">#</th>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-left px-3 py-2">HSN/SAC</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Disc %</th>
                  <th className="text-right px-3 py-2">Taxable</th>
                  <th className="text-right px-3 py-2">GST%</th>
                  <th className="text-right px-3 py-2 rounded-tr">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((item: {
                  sort_order: number;
                  description: string;
                  hsn_sac_code: string;
                  quantity: number;
                  rate: number;
                  discount_percent: number;
                  gst_rate: number;
                  taxable_amount: number;
                  line_total: number;
                }, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.description}</td>
                    <td className="px-3 py-2 text-gray-500">{item.hsn_sac_code}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{fmt(item.rate)}</td>
                    <td className="px-3 py-2 text-right">{item.discount_percent}%</td>
                    <td className="px-3 py-2 text-right">{fmt(item.taxable_amount)}</td>
                    <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Taxable Amount</span>
                <span>{fmt(invoice.taxable_amount)}</span>
              </div>
              {invoice.is_inter_state ? (
                <div className="flex justify-between text-gray-600">
                  <span>IGST</span>
                  <span>{fmt(invoice.total_igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>CGST</span>
                    <span>{fmt(invoice.total_cgst)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>SGST</span>
                    <span>{fmt(invoice.total_sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-base border-t border-blue-700 pt-2 mt-1 text-blue-700">
                <span>Total Amount</span>
                <span>{fmt(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t pt-4 text-sm text-gray-600">
              <p className="text-xs uppercase text-gray-400 font-medium mb-1">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-4 border-t">
            <Button variant="outline" asChild>
              <Link href={`/api/invoice/${token}/pdf`} target="_blank">
                ↓ Download PDF
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
