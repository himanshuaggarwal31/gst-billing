import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";

function nicDate(dateStr: string): string {
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

  const [{ data: challan }, { data: ewb }, { data: profile }] = await Promise.all([
    supabase
      .from("challans")
      .select("*, challan_items(*), clients(*), from_location:from_location_id(name, type, address), to_location:to_location_id(name, type, address)")
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
      .select("business_name, gstin, address, city, state_code, pincode")
      .eq("id", ownerId)
      .single(),
  ]);

  if (!challan) return new NextResponse("Challan not found", { status: 404 });
  if (!ewb) {
    return new NextResponse(
      JSON.stringify({ error: "Save transport details before downloading JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const fromStateCode = parseInt(profile?.state_code ?? "0", 10) || 0;
  const fromPincode   = parseInt(profile?.pincode    ?? "0", 10) || 0;

  // Delivery challan: "to" is the recipient (client or to_location)
  const client = challan.clients as { name: string; gstin: string | null; address: string | null; city: string | null; state_code: string; pincode: string | null } | null;
  const toName       = client?.name        ?? (challan.to_location as { name?: string } | null)?.name ?? challan.to_location_name ?? "";
  const toGstin      = client?.gstin       ?? "URP";
  const toAddr       = client?.address     ?? (challan.to_location as { address?: string | null } | null)?.address ?? "";
  const toCity       = client?.city        ?? "";
  const toStateCode  = parseInt(client?.state_code ?? fromStateCode.toString(), 10) || fromStateCode;
  const toPincode    = parseInt(client?.pincode    ?? "0", 10) || 0;

  // Resolved FK parties — one of each group wins
  type Party = { name?: string; label?: string; gstin: string | null; address: string | null; city: string | null; state_code: string | null; pincode: string | null } | null;

  const rawDispatchFromLocation = (ewb?.dispatch_from_location as Party) ?? null;
  const rawDispatchFromSupplier = (ewb?.dispatch_from_supplier as Party) ?? null;
  const rawShipToClient         = (ewb?.ship_to_client   as Party) ?? null;
  const rawShipToBranch         = (ewb?.ship_to_branch   as Party) ?? null;
  const rawShipToLocation       = (ewb?.ship_to_location as Party) ?? null;

  const dispatchFrom: (Party & { name: string }) | null =
    rawDispatchFromLocation ? { ...rawDispatchFromLocation, name: rawDispatchFromLocation.name ?? "" } :
    rawDispatchFromSupplier ? { ...rawDispatchFromSupplier, name: rawDispatchFromSupplier.name ?? "" } :
    null;

  const shipTo: (Party & { name: string }) | null =
    rawShipToClient   ? { ...rawShipToClient,   name: rawShipToClient.name   ?? "" } :
    rawShipToBranch   ? { ...rawShipToBranch,   name: rawShipToBranch.label  ?? "" } :
    rawShipToLocation ? { ...rawShipToLocation, name: rawShipToLocation.name ?? "" } :
    null;

  const actFromStateCode = parseInt(dispatchFrom?.state_code ?? fromStateCode.toString(), 10) || fromStateCode;
  const actToStateCode   = parseInt(shipTo?.state_code       ?? toStateCode.toString(),   10) || toStateCode;
  const actFromPincode   = parseInt(dispatchFrom?.pincode    ?? fromPincode.toString(),   10) || fromPincode;
  const actToPincode     = parseInt(shipTo?.pincode          ?? toPincode.toString(),     10) || toPincode;

  const hasDiffDispatch  = !!dispatchFrom;
  const hasDiffShipTo    = !!shipTo;
  const transactionType  = hasDiffDispatch && hasDiffShipTo ? 2
    : hasDiffDispatch ? 3
    : hasDiffShipTo   ? 4
    : 1;

  const items = (challan.challan_items as Array<{
    description: string; hsn_sac_code: string; quantity: number; unit: string; sort_order: number;
  }>)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, idx) => ({
      itemNo:           idx + 1,
      productName:      item.description.slice(0, 100),
      productDesc:      item.description.slice(0, 100),
      hsnCode:          item.hsn_sac_code || "0000",
      quantity:         item.quantity,
      qtyUnit:          (item.unit ?? "NOS").toUpperCase(),
      cgstRate:         0,
      sgstRate:         0,
      igstRate:         0,
      cessRate:         0,
      cessNonAdvolRate: 0,
      taxableAmount:    0,
    }));

  // subSupplyType: 10 = Delivery Challan (as per NIC portal)
  const subSupplyType = ewb.sub_supply_type ?? 10;

  const nicJson = {
    version: "1.0.0621",
    billLists: [
      {
        supplyType:       ewb.supply_type     ?? "O",
        subSupplyType,
        subSupplyDesc:    subSupplyType === 8 ? "Delivery Challan" : "",
        docType:          "CHL",
        docNo:            challan.challan_number,
        docDate:          nicDate(challan.challan_date),

        fromGstin:        profile?.gstin || "URP",
        fromTrdName:      profile?.business_name || "",
        fromAddr1:        profile?.address || "",
        fromAddr2:        "",
        fromPlace:        profile?.city   || "",
        fromPincode,
        fromStateCode,
        actFromStateCode,
        actFromPincode,

        toGstin:          toGstin,
        toTrdName:        toName,
        toAddr1:          toAddr,
        toAddr2:          "",
        toPlace:          toCity,
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

        totalValue:       0,
        cgstValue:        0,
        sgstValue:        0,
        igstValue:        0,
        cessValue:        0,
        cessNonAdvolValue: 0,
        totInvValue:      0,

        transMode:        ewb.transport_mode  ?? "1",
        transDistance:    String(ewb.distance_km ?? 0),
        transporterName:  ewb.transporter_name ?? "",
        transporterId:    ewb.transporter_id   ?? "",
        transDocNo:       ewb.trans_doc_no     ?? "",
        transDocDate:     ewb.trans_doc_date ? nicDate(ewb.trans_doc_date) : "",
        vehicleNo:        (ewb.vehicle_no ?? "").toUpperCase(),
        vehicleType:      ewb.vehicle_type ?? "R",

        itemList: items,
      },
    ],
  };

  const safe = challan.challan_number.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new NextResponse(JSON.stringify(nicJson, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ewb-${safe}.json"`,
    },
  });
}
