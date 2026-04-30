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

  const { data: quote, error } = await supabase
    .from("quotations")
    .select(`*, clients(*), quotation_line_items(*)`)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !quote) return new NextResponse("Not found", { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, business_email, business_phone")
    .eq("id", ownerId)
    .single();

  const pdfData = {
    invoice_number: quote.quote_number,
    invoice_date: quote.quote_date,
    due_date: quote.valid_until ?? null,
    payment_status: quote.status,
    pdf_status_style: "none" as const,
    notes: quote.notes ?? null,
    theme: (quote.theme ?? "classic") as "classic" | "minimal" | "modern",
    seller_state_code: quote.seller_state_code,
    buyer_state_code: quote.clients.state_code,
    is_inter_state: quote.seller_state_code !== quote.clients.state_code,
    taxable_amount: quote.taxable_amount,
    total_cgst: quote.total_cgst,
    total_sgst: quote.total_sgst,
    total_igst: quote.total_igst,
    total_gst: quote.total_gst,
    total_amount: quote.total_amount,
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
    client: quote.clients,
    line_items: quote.quotation_line_items,
  };

  const buffer = await renderToBuffer(
    createElement(InvoicePDF, {
      data: pdfData,
      documentTitle: "QUOTATION",
      documentLabel: "Quote No.",
    })
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quotation-${quote.quote_number}.pdf"`,
    },
  });
}
