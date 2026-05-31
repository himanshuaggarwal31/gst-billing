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
      .select(`
        *,
        dispatch_from_location:dispatch_from_location_id(id, name, gstin, address, city, state_code, pincode),
        dispatch_from_supplier:dispatch_from_supplier_id(id, name, gstin, address, city, state_code, pincode),
        ship_to_client:ship_to_client_id(id, name, gstin, address, city, state_code, pincode),
        ship_to_branch:ship_to_branch_id(id, label, gstin, address, city, state_code, pincode),
        ship_to_location:ship_to_location_id(id, name, gstin, address, city, state_code, pincode)
      `)
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

  // Resolved FK parties — one of each group wins (priority: first non-null in order)
  type Party = { name?: string; label?: string; gstin: string | null; address: string | null; city: string | null; state_code: string | null; pincode: string | null } | null;

  const rawDispatchFromLocation = (ewb?.dispatch_from_location as Party) ?? null;
  const rawDispatchFromSupplier = (ewb?.dispatch_from_supplier as Party) ?? null;
  const rawShipToClient         = (ewb?.ship_to_client   as Party) ?? null;
  const rawShipToBranch         = (ewb?.ship_to_branch   as Party) ?? null;
  const rawShipToLocation       = (ewb?.ship_to_location as Party) ?? null;

  // Normalise: branches use "label" instead of "name"
  const dispatchFrom: (Party & { name: string }) | null =
    rawDispatchFromLocation ? { ...rawDispatchFromLocation, name: rawDispatchFromLocation.name ?? "" } :
    rawDispatchFromSupplier ? { ...rawDispatchFromSupplier, name: rawDispatchFromSupplier.name ?? "" } :
    null;

  const shipTo: (Party & { name: string }) | null =
    rawShipToClient   ? { ...rawShipToClient,   name: rawShipToClient.name   ?? "" } :
    rawShipToBranch   ? { ...rawShipToBranch,   name: rawShipToBranch.label  ?? "" } :
    rawShipToLocation ? { ...rawShipToLocation, name: rawShipToLocation.name ?? "" } :
    null;

  const dispatchFromStateCode = dispatchFrom?.state_code ?? sellerStateCode;
  const shipToStateCode       = shipTo?.state_code       ?? buyerStateCode;
  const isInterState          = dispatchFromStateCode !== shipToStateCode;

  const fromStateCode    = parseInt(sellerStateCode,        10) || 0;
  const toStateCode      = parseInt(buyerStateCode,         10) || 0;
  const actFromStateCode = parseInt(dispatchFromStateCode,  10) || fromStateCode;
  const actToStateCode   = parseInt(shipToStateCode,        10) || toStateCode;
  const fromPincode      = parseInt(profile?.pincode        ?? "0", 10) || 0;
  const toPincode        = parseInt(client.pincode          ?? "0", 10) || 0;
  const actFromPincode   = parseInt(dispatchFrom?.pincode   ?? String(fromPincode), 10) || fromPincode;
  const actToPincode     = parseInt(shipTo?.pincode         ?? String(toPincode),   10) || toPincode;

  const hasDiffDispatch = !!dispatchFrom;
  const hasDiffShipTo   = !!shipTo;
  const transactionType = hasDiffDispatch && hasDiffShipTo ? 2
    : hasDiffDispatch ? 3
    : hasDiffShipTo   ? 4
    : 1;

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
        actFromStateCode,
        actFromPincode,

        toGstin:          client.gstin || "URP",
        toTrdName:        client.name,
        toAddr1:          client.address || "",
        toAddr2:          "",
        toPlace:          client.city   || "",
        toPincode,
        toStateCode,
        actToStateCode,
        actToPincode,

        // Dispatch From (only when a location is selected)
        ...(dispatchFrom ? {
          dispatchFromGstin:      dispatchFrom.gstin   || "URP",
          dispatchFromTrdName:    dispatchFrom.name,
          dispatchFromAddr1:      dispatchFrom.address || "",
          dispatchFromAddr2:      "",
          dispatchFromPlace:      dispatchFrom.city    || "",
          dispatchFromPincode:    actFromPincode,
          dispatchFromStateCode:  actFromStateCode,
        } : {}),

        // Ship To (only when a client is selected)
        ...(shipTo ? {
          shipToGstin:            shipTo.gstin   || "URP",
          shipToTrdName:          shipTo.name,
          shipToAddr1:            shipTo.address || "",
          shipToAddr2:            "",
          shipToPlace:            shipTo.city    || "",
          shipToPincode:          actToPincode,
          shipToStateCode:        actToStateCode,
        } : {}),

        transactionType,

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
