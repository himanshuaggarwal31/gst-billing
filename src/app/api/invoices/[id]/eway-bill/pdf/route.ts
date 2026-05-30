import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EWayBillPDF } from "@/components/invoice/EWayBillPDF";
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

  const [{ data: invoice, error: invErr }, { data: ewb }, { data: profile }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(*), invoice_line_items(*)")
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("eway_bills")
      .select("*")
      .eq("invoice_id", id)
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, pdf_accent_color, pdf_show_amount_in_words, pdf_footer_text, pdf_footer_text_ewb")
      .eq("id", ownerId)
      .single(),
  ]);

  if (invErr || !invoice) return new NextResponse("Not found", { status: 404 });
  if (!ewb?.eway_bill_number) {
    return new NextResponse(
      JSON.stringify({ error: "e-Way Bill number not set. Save the EWB number before printing." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = invoice.clients as {
    name: string; gstin: string | null; address: string | null;
    city: string | null; state_code: string; pincode: string | null;
  };

  const isInterState =
    (invoice.seller_state_code as string)?.trim() !== (client.state_code as string)?.trim();

  const pdfData = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    taxable_amount: invoice.taxable_amount,
    total_cgst: invoice.total_cgst,
    total_sgst: invoice.total_sgst,
    total_igst: invoice.total_igst,
    total_gst: invoice.total_gst,
    total_amount: invoice.total_amount,
    is_inter_state: isInterState,
    eway_bill: {
      eway_bill_number: ewb.eway_bill_number,
      valid_until:      ewb.valid_until      ?? null,
      supply_type:      ewb.supply_type      ?? "O",
      sub_supply_type:  ewb.sub_supply_type  ?? 1,
      transport_mode:   ewb.transport_mode   ?? "1",
      distance_km:      ewb.distance_km      ?? 0,
      transporter_name: ewb.transporter_name ?? null,
      transporter_id:   ewb.transporter_id   ?? null,
      vehicle_no:       ewb.vehicle_no       ?? null,
      vehicle_type:     ewb.vehicle_type     ?? "R",
      trans_doc_no:     ewb.trans_doc_no     ?? null,
      trans_doc_date:   ewb.trans_doc_date   ?? null,
    },
    seller: {
      business_name: profile?.business_name || "My Business",
      gstin:         profile?.gstin    ?? null,
      address:       profile?.address  ?? null,
      city:          profile?.city     ?? null,
      state_code:    profile?.state_code ?? invoice.seller_state_code ?? null,
      pincode:       profile?.pincode  ?? null,
    },
    client: {
      name:       client.name,
      gstin:      client.gstin    ?? null,
      address:    client.address  ?? null,
      city:       client.city     ?? null,
      state_code: client.state_code,
      pincode:    client.pincode  ?? null,
    },
    line_items: (invoice.invoice_line_items as Array<{
      sort_order: number; description: string; hsn_sac_code: string;
      quantity: number; gst_rate: number; taxable_amount: number; line_total: number;
    }>),
    accent_color: profile?.pdf_accent_color ?? null,
    show_amount_in_words: profile?.pdf_show_amount_in_words ?? false,
    footer_text: profile?.pdf_footer_text_ewb ?? profile?.pdf_footer_text ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(EWayBillPDF, { data: pdfData }) as any);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ewb-${invoice.invoice_number}.pdf"`,
    },
  });
}
