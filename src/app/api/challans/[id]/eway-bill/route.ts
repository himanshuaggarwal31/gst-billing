import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const EWayBillSchema = z.object({
  supply_type:      z.enum(["O", "I"]).default("O"),
  sub_supply_type:  z.number().int().min(1).max(12).default(10), // 10 = Delivery Challan
  transport_mode:   z.enum(["1", "2", "3", "4"]).default("1"),
  distance_km:      z.number().int().min(0).default(0),
  transporter_name: z.string().optional().nullable(),
  transporter_id:   z.string().optional().nullable(),
  vehicle_no:       z.string().optional().nullable(),
  vehicle_type:     z.enum(["R", "O"]).default("R"),
  trans_doc_no:     z.string().optional().nullable(),
  trans_doc_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  eway_bill_number: z.string().optional().nullable(),
  valid_until:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  // Bill-To / Ship-To (FK references)
  // Dispatch From: at most one of these should be set
  dispatch_from_location_id: z.string().uuid().optional().nullable(),
  dispatch_from_supplier_id: z.string().uuid().optional().nullable(),
  // Ship To: at most one of these should be set
  ship_to_client_id:         z.string().uuid().optional().nullable(),
  ship_to_branch_id:         z.string().uuid().optional().nullable(),
  ship_to_location_id:       z.string().uuid().optional().nullable(),
}).refine(
  (d) => (
    [d.dispatch_from_location_id, d.dispatch_from_supplier_id].filter(Boolean).length <= 1
  ),
  { message: "Only one Dispatch From source can be set at a time" }
).refine(
  (d) => (
    [d.ship_to_client_id, d.ship_to_branch_id, d.ship_to_location_id].filter(Boolean).length <= 1
  ),
  { message: "Only one Ship To destination can be set at a time" }
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [{ data }, { data: challan }] = await Promise.all([
    supabase
      .from("eway_bills")
      .select("*")
      .eq("challan_id", id)
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("challans")
      .select("transporter_name, vehicle_number")
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
  ]);

  if (data) {
    // Existing EWB record — return as-is
    return NextResponse.json(apiSuccess(data));
  }

  // No record yet — seed defaults from challan transport details
  const defaults = {
    supply_type:      "O",
    sub_supply_type:  10,
    transport_mode:   "1",
    distance_km:      0,
    transporter_name: challan?.transporter_name ?? null,
    transporter_id:   null,
    vehicle_no:       challan?.vehicle_number ? challan.vehicle_number.toUpperCase() : null,
    vehicle_type:     "R",
    trans_doc_no:     null,
    trans_doc_date:   null,
    eway_bill_number: null,
    valid_until:      null,
  };

  return NextResponse.json(apiSuccess(defaults));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit e-Way Bills", "FORBIDDEN"), { status: 403 });
  }

  // Verify challan belongs to owner
  const { data: challan } = await supabase
    .from("challans")
    .select("id")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();
  if (!challan) return NextResponse.json(apiError("Challan not found", "NOT_FOUND"), { status: 404 });

  const body = await req.json();
  const parsed = EWayBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  // Use explicit insert/update because the UNIQUE index on challan_id is a partial
  // index (WHERE challan_id IS NOT NULL) which PostgreSQL won't use for ON CONFLICT.
  const { data: existing } = await supabase
    .from("eway_bills")
    .select("id")
    .eq("challan_id", id)
    .eq("user_id", ownerId)
    .maybeSingle();

  // Extract party FK fields separately — only include them when non-null so the route
  // works even before the multi-party migrations have been run on the DB.
  const {
    dispatch_from_location_id,
    dispatch_from_supplier_id,
    ship_to_client_id,
    ship_to_branch_id,
    ship_to_location_id,
    ...coreData
  } = parsed.data;

  const partyFields = {
    ...(dispatch_from_location_id != null ? { dispatch_from_location_id } : {}),
    ...(dispatch_from_supplier_id  != null ? { dispatch_from_supplier_id }  : {}),
    ...(ship_to_client_id          != null ? { ship_to_client_id }          : {}),
    ...(ship_to_branch_id          != null ? { ship_to_branch_id }          : {}),
    ...(ship_to_location_id        != null ? { ship_to_location_id }        : {}),
  };

  let data, error;
  if (existing) {
    ({ data, error } = await supabase
      .from("eway_bills")
      .update({ ...coreData, ...partyFields, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("eway_bills")
      .insert({ challan_id: id, user_id: ownerId, ...coreData, ...partyFields })
      .select()
      .single());
  }

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}
