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
      .select("*")
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
        actFromStateCode: fromStateCode,

        toGstin:          toGstin,
        toTrdName:        toName,
        toAddr1:          toAddr,
        toAddr2:          "",
        toPlace:          toCity,
        toPincode,
        toStateCode,
        actToStateCode:   toStateCode,

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
