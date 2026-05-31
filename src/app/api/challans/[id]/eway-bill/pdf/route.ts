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

  const [{ data: challan, error: challanErr }, { data: ewb }, { data: profile }] = await Promise.all([
    supabase
      .from("challans")
      .select("*, clients(*), challan_items(*), from_location:from_location_id(name, address), to_location:to_location_id(name, address)")
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("eway_bills")
      .select(`
        *,
        dispatch_from_location:dispatch_from_location_id(id, name, gstin, address, city, state_code, pincode),
        dispatch_from_supplier:dispatch_from_supplier_id(id, name, gstin, address, city, state_code, pincode),
        ship_to_client:ship_to_client_id(id, name, gstin, address, city, state_code, pincode),
        ship_to_branch:ship_to_branch_id(id, label, gstin, address, city, state_code, pincode),
        ship_to_location:ship_to_location_id(id, name, gstin, address, city, state_code, pincode)
      `)
      .eq("challan_id", id)
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, pdf_accent_color, pdf_theme, pdf_show_amount_in_words, pdf_footer_text, pdf_footer_text_ewb")
      .eq("id", ownerId)
      .single(),
  ]);

  if (challanErr || !challan) return new NextResponse("Not found", { status: 404 });
  if (!ewb?.eway_bill_number) {
    return new NextResponse(
      JSON.stringify({ error: "e-Way Bill number not set. Save the EWB number before printing." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = challan.clients as {
    name: string; gstin: string | null; address: string | null;
    city: string | null; state_code: string; pincode: string | null;
  } | null;
  const toLocation = challan.to_location as { name: string; address: string | null } | null;

  // Consignee: prefer client, fall back to to_location
  const toName       = client?.name       ?? toLocation?.name    ?? "—";
  const toGstin      = client?.gstin      ?? null;
  const toAddr       = client?.address    ?? toLocation?.address ?? null;
  const toCity       = client?.city       ?? null;
  const toStateCode  = client?.state_code ?? profile?.state_code ?? "00";
  const toPincode    = client?.pincode    ?? null;

  const sortedItems = ([...(challan.challan_items as Array<{
    sort_order: number; description: string; hsn_sac_code: string | null; quantity: number; unit: string;
  }>)]).sort((a, b) => a.sort_order - b.sort_order);

  const pdfData = {
    invoice_number:      challan.challan_number,
    invoice_date:        challan.challan_date,
    doc_label:           "Challan",
    taxable_amount:      0,
    total_cgst:          0,
    total_sgst:          0,
    total_igst:          0,
    total_gst:           0,
    total_amount:        0,
    is_inter_state:      false,
    eway_bill: {
      eway_bill_number: ewb.eway_bill_number,
      valid_until:      ewb.valid_until      ?? null,
      supply_type:      ewb.supply_type      ?? "O",
      sub_supply_type:  ewb.sub_supply_type  ?? 10,
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
      state_code:    profile?.state_code ?? null,
      pincode:       profile?.pincode  ?? null,
    },
    client: {
      name:       toName,
      gstin:      toGstin,
      address:    toAddr,
      city:       toCity,
      state_code: toStateCode,
      pincode:    toPincode,
    },
    line_items: sortedItems.map((item) => ({
      sort_order:     item.sort_order,
      description:    item.description,
      hsn_sac_code:   item.hsn_sac_code ?? "",
      quantity:       item.quantity,
      gst_rate:       0,
      taxable_amount: 0,
      line_total:     0,
    })),
    dispatch_from: (() => {
      type P = { name?: string; label?: string; gstin: string | null; address: string | null; city: string | null; state_code: string | null; pincode: string | null } | null;
      const loc = (ewb?.dispatch_from_location as P) ?? null;
      const sup = (ewb?.dispatch_from_supplier as P) ?? null;
      const raw = loc ?? sup;
      if (!raw) return null;
      return { name: raw.name ?? "", gstin: raw.gstin ?? null, addr: raw.address ?? null, city: raw.city ?? null, state: raw.state_code ?? null, pincode: raw.pincode ?? null };
    })(),
    ship_to: (() => {
      type P = { name?: string; label?: string; gstin: string | null; address: string | null; city: string | null; state_code: string | null; pincode: string | null } | null;
      const cli = (ewb?.ship_to_client   as P) ?? null;
      const brn = (ewb?.ship_to_branch   as P) ?? null;
      const sloc= (ewb?.ship_to_location as P) ?? null;
      const raw = cli ?? brn ?? sloc;
      if (!raw) return null;
      const name = cli ? (cli.name ?? "") : brn ? (brn.label ?? "") : (sloc?.name ?? "");
      return { name, gstin: raw.gstin ?? null, addr: raw.address ?? null, city: raw.city ?? null, state: raw.state_code ?? null, pincode: raw.pincode ?? null };
    })(),
    accent_color:         profile?.pdf_accent_color           ?? null,
    pdf_theme:            profile?.pdf_theme                  ?? null,
    show_amount_in_words: profile?.pdf_show_amount_in_words   ?? false,
    footer_text:          profile?.pdf_footer_text_ewb ?? profile?.pdf_footer_text ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(EWayBillPDF, { data: pdfData }) as any);
  const safe       = challan.challan_number.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeClient = (challan.clients as { name: string } | null)?.name
    ?.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-") ?? "";

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ewb-${safe}${safeClient ? `-${safeClient}` : ""}.pdf"`,
    },
  });
}
