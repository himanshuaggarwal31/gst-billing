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
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, business_email, business_phone, pdf_theme, pdf_accent_color, pdf_footer_text, pdf_footer_text_quotation, pdf_terms, pdf_show_amount_in_words, pdf_print_copies")
    .eq("id", ownerId)
    .single();

  const pdfData = {
    invoice_number: quote.quote_number,
    invoice_date: quote.quote_date,
    due_date: quote.valid_until ?? null,
    payment_status: quote.status,
    pdf_status_style: "none" as const,
    notes: quote.notes ?? null,
    theme: (quote.theme ?? profile?.pdf_theme ?? "classic") as "classic" | "minimal" | "modern",
    accent_color: profile?.pdf_accent_color ?? null,
    footer_text: profile?.pdf_footer_text_quotation ?? profile?.pdf_footer_text ?? null,
    terms: profile?.pdf_terms ?? null,
    show_amount_in_words: profile?.pdf_show_amount_in_words ?? false,
    seller_state_code: (quote.seller_state_code as string)?.trim(),
    buyer_state_code: (quote.clients.state_code as string)?.trim(),
    is_inter_state: (quote.seller_state_code as string)?.trim() !== (quote.clients.state_code as string)?.trim(),
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
    line_items: quote.quotation_line_items.map((li: {
      sort_order: number; description: string; hsn_sac_code: string;
      quantity: number; rate: number; discount_percent: number; gst_rate: number;
      taxable_amount: number; gst_amount: number; total_amount: number;
    }) => {
      const isInter = (quote.seller_state_code as string)?.trim() !== (quote.clients.state_code as string)?.trim();
      return {
        sort_order: li.sort_order,
        description: li.description,
        hsn_sac_code: li.hsn_sac_code,
        quantity: li.quantity,
        rate: li.rate,
        discount_percent: li.discount_percent,
        gst_rate: li.gst_rate,
        taxable_amount: li.taxable_amount,
        cgst: isInter ? 0 : li.gst_amount / 2,
        sgst: isInter ? 0 : li.gst_amount / 2,
        igst: isInter ? li.gst_amount : 0,
        total_gst: li.gst_amount,
        line_total: li.total_amount,
      };
    }),
  };

  const printCopies = (profile?.pdf_print_copies ?? false);
  const buffer = await renderToBuffer(
    createElement(InvoicePDF, {
      data: pdfData,
      documentTitle: "QUOTATION",
      documentLabel: "Quote No.",
      printCopies,
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
