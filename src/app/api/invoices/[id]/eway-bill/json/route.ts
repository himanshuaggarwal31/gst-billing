import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";

function nicDate(dateStr: string): string {
  // NIC portal expects DD/MM/YYYY
  const d = new Date(dateStr);
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [{ data: invoice }, { data: ewb }, { data: profile }] = await Promise.all([
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
      .select("business_name, gstin, address, city, state_code, pincode")
      .eq("id", ownerId)
      .single(),
  ]);

  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
  if (!ewb) {
    return new NextResponse(
      JSON.stringify({ error: "Save transport details before downloading JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = invoice.clients as {
    name: string; gstin: string | null; address: string | null;
    city: string | null; state_code: string; pincode: string | null;
  };

  const sellerStateCode = (profile?.state_code ?? invoice.seller_state_code ?? "0").trim();
  const buyerStateCode  = (client.state_code ?? "0").trim();
  const isInterState    = sellerStateCode !== buyerStateCode;

  const fromStateCode = parseInt(sellerStateCode, 10) || 0;
  const toStateCode   = parseInt(buyerStateCode,  10) || 0;
  const fromPincode   = parseInt(profile?.pincode ?? "0", 10) || 0;
  const toPincode     = parseInt(client.pincode   ?? "0", 10) || 0;

  const lineItems = (invoice.invoice_line_items as Array<{
    description: string; hsn_sac_code: string;
    quantity: number; gst_rate: number; taxable_amount: number; sort_order: number;
  }>)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, idx) => ({
      itemNo:           idx + 1,
      productName:      item.description.slice(0, 100),
      productDesc:      item.description.slice(0, 100),
      hsnCode:          item.hsn_sac_code || "0000",
      quantity:         item.quantity,
      qtyUnit:          "NOS",
      cgstRate:         isInterState ? 0   : item.gst_rate / 2,
      sgstRate:         isInterState ? 0   : item.gst_rate / 2,
      igstRate:         isInterState ? item.gst_rate : 0,
      cessRate:         0,
      cessNonAdvolRate: 0,
      taxableAmount:    item.taxable_amount,
    }));

  const nicJson = {
    version: "1.0.0621",
    billLists: [
      {
        supplyType:       ewb.supply_type     ?? "O",
        subSupplyType:    ewb.sub_supply_type ?? 1,
        subSupplyDesc:    "",
        docType:          "INV",
        docNo:            invoice.invoice_number,
        docDate:          nicDate(invoice.invoice_date),

        fromGstin:        profile?.gstin || "URP",
        fromTrdName:      profile?.business_name || "",
        fromAddr1:        profile?.address || "",
        fromAddr2:        "",
        fromPlace:        profile?.city   || "",
        fromPincode,
        fromStateCode,
        actFromStateCode: fromStateCode,

        toGstin:          client.gstin || "URP",
        toTrdName:        client.name,
        toAddr1:          client.address || "",
        toAddr2:          "",
        toPlace:          client.city   || "",
        toPincode,
        toStateCode,
        actToStateCode:   toStateCode,

        totalValue:       invoice.taxable_amount,
        cgstValue:        invoice.total_cgst,
        sgstValue:        invoice.total_sgst,
        igstValue:        invoice.total_igst,
        cessValue:        0,
        cessNonAdvolValue: 0,
        totInvValue:      invoice.total_amount,

        transMode:        ewb.transport_mode  ?? "1",
        transDistance:    String(ewb.distance_km ?? 0),
        transporterName:  ewb.transporter_name ?? "",
        transporterId:    ewb.transporter_id   ?? "",
        transDocNo:       ewb.trans_doc_no     ?? "",
        transDocDate:     ewb.trans_doc_date ? nicDate(ewb.trans_doc_date) : "",
        vehicleNo:        (ewb.vehicle_no ?? "").toUpperCase(),
        vehicleType:      ewb.vehicle_type     ?? "R",

        itemList: lineItems,
      },
    ],
  };

  return new NextResponse(JSON.stringify(nicJson, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ewb-${invoice.invoice_number}.json"`,
    },
  });
}
