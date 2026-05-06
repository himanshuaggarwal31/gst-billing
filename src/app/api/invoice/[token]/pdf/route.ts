import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";

// Use service role key server-side so RLS doesn't block profile/client joins
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`*, clients(*), invoice_line_items(*)`)
    .eq("public_token", token)
    .single();

  if (error || !invoice) return new NextResponse("Invoice not found", { status: 404 });

  const [{ data: profileData }, { data: ewb }] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, pdf_status_style, business_email, business_phone")
      .eq("id", invoice.user_id)
      .single(),
    supabase
      .from("eway_bills")
      .select("eway_bill_number, valid_until")
      .eq("invoice_id", invoice.id)
      .maybeSingle(),
  ]);

  const pdfData = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    payment_status: invoice.payment_status,
    pdf_status_style: (profileData?.pdf_status_style ?? "stamp") as "stamp" | "badge" | "none",
    notes: invoice.notes,
    theme: invoice.theme ?? "classic",
    seller_state_code: invoice.seller_state_code,
    buyer_state_code: invoice.buyer_state_code,
    is_inter_state: invoice.is_inter_state,
    taxable_amount: invoice.taxable_amount,
    total_cgst: invoice.total_cgst,
    total_sgst: invoice.total_sgst,
    total_igst: invoice.total_igst,
    total_gst: invoice.total_gst,
    total_amount: invoice.total_amount,
    eway_bill_number: ewb?.eway_bill_number ?? null,
    eway_bill_valid_until: ewb?.valid_until ?? null,
    seller: {
      business_name: profileData?.business_name ?? "Business",
      gstin: profileData?.gstin ?? null,
      address: profileData?.address ?? null,
      city: profileData?.city ?? null,
      state_code: profileData?.state_code ?? null,
      pincode: profileData?.pincode ?? null,
      email: profileData?.business_email || profileData?.email || "",
      phone: (profileData?.business_phone || profileData?.phone) ?? null,
      pan: profileData?.pan ?? null,
      logo_url: profileData?.logo_url ?? null,
    },
    client: invoice.clients,
    line_items: invoice.invoice_line_items,
  };

  const buffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData }));

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
