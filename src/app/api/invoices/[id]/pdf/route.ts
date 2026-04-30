import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  // Fetch invoice with client and line items
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(`*, clients(*), invoice_line_items(*)`)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (invErr || !invoice) return new NextResponse("Not found", { status: 404 });

  // Fetch seller profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, pdf_status_style, business_email, business_phone")
    .eq("id", ownerId)
    .single();

  const pdfData = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    payment_status: invoice.payment_status,
    pdf_status_style: (profile?.pdf_status_style ?? "stamp") as "stamp" | "badge" | "none",
    notes: invoice.notes,
    theme: invoice.theme ?? "classic",
    seller_state_code: (invoice.seller_state_code as string)?.trim(),
    buyer_state_code: (invoice.buyer_state_code as string)?.trim(),
    is_inter_state: (invoice.seller_state_code as string)?.trim() !== (invoice.buyer_state_code as string)?.trim(),
    taxable_amount: invoice.taxable_amount,
    total_cgst: invoice.total_cgst,
    total_sgst: invoice.total_sgst,
    total_igst: invoice.total_igst,
    total_gst: invoice.total_gst,
    total_amount: invoice.total_amount,
    seller: {
      business_name: profile?.business_name || "My Business",
      gstin: profile?.gstin ?? null,
      address: profile?.address ?? null,
      city: profile?.city ?? null,
      state_code: profile?.state_code ?? null,
      pincode: profile?.pincode ?? null,
      email: profile?.business_email || profile?.email || user.email || "",
      phone: (profile?.business_phone || profile?.phone) ?? null,
      pan: profile?.pan ?? null,
      logo_url: profile?.logo_url ?? null,
    },
    client: invoice.clients,
    line_items: invoice.invoice_line_items,
  };

  const buffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData }));

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
