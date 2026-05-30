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

  // Fetch invoice with client and line items, plus eway_bill and e_invoice in parallel
  const [{ data: invoice, error: invErr }, { data: ewb }, { data: profile }, { data: einvoice }] = await Promise.all([
    supabase
      .from("invoices")
      .select(`*, clients(*), invoice_line_items(*)`)
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("eway_bills")
      .select("eway_bill_number, valid_until")
      .eq("invoice_id", id)
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, pdf_status_style, business_email, business_phone, pdf_theme, pdf_accent_color, pdf_footer_text, pdf_footer_text_invoice, pdf_terms, pdf_show_amount_in_words, pdf_print_copies")
      .eq("id", ownerId)
      .single(),
    supabase
      .from("e_invoices")
      .select("irn, ack_no, ack_date, signed_qr, status")
      .eq("invoice_id", id)
      .eq("user_id", ownerId)
      .maybeSingle(),
  ]);

  if (invErr || !invoice) return new NextResponse("Not found", { status: 404 });

  // Generate QR code data URL server-side if e-invoice has a signed QR
  let eInvoiceQrDataUrl: string | null = null;
  if (einvoice?.status === "generated" && einvoice.signed_qr) {
    const QRCode = await import("qrcode");
    eInvoiceQrDataUrl = await QRCode.toDataURL(einvoice.signed_qr, { width: 128, margin: 1 });
  }

  const pdfData = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    payment_status: invoice.payment_status,
    pdf_status_style: (profile?.pdf_status_style ?? "stamp") as "stamp" | "badge" | "none",
    notes: invoice.notes,
    theme: (invoice.theme ?? profile?.pdf_theme ?? "classic") as "classic" | "minimal" | "modern",
    accent_color: profile?.pdf_accent_color ?? null,
    footer_text: profile?.pdf_footer_text_invoice ?? profile?.pdf_footer_text ?? null,
    terms: profile?.pdf_terms ?? null,
    show_amount_in_words: profile?.pdf_show_amount_in_words ?? false,
    seller_state_code: (invoice.seller_state_code as string)?.trim(),
    buyer_state_code: (invoice.buyer_state_code as string)?.trim(),
    is_inter_state: (invoice.seller_state_code as string)?.trim() !== (invoice.buyer_state_code as string)?.trim(),
    taxable_amount: invoice.taxable_amount,
    total_cgst: invoice.total_cgst,
    total_sgst: invoice.total_sgst,
    total_igst: invoice.total_igst,
    total_gst: invoice.total_gst,
    total_amount: invoice.total_amount,
    eway_bill_number: ewb?.eway_bill_number ?? null,
    eway_bill_valid_until: ewb?.valid_until ?? null,
    e_invoice: (einvoice?.status === "generated" && einvoice.irn)
      ? {
          irn:         einvoice.irn,
          ack_no:      einvoice.ack_no ?? null,
          ack_date:    einvoice.ack_date ?? null,
          qr_data_url: eInvoiceQrDataUrl,
        }
      : null,
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

  const copyLabels = Array.isArray(profile?.pdf_copy_labels) ? (profile.pdf_copy_labels as string[]) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData, copyLabels }) as any);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
