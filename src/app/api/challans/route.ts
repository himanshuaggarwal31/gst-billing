import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const UNITS = ["nos", "pcs", "kg", "mtr", "rmt", "set", "box", "ltr", "sqm", "sqft", "ton", "other"] as const;

const ChallanItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Item description is required"),
  hsn_sac_code: z.string().default(""),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.enum(UNITS).default("nos"),
  remarks: z.string().optional().nullable(),
});

const ChallanSchema = z.object({
  challan_number: z.string().min(1, "Challan number is required"),
  challan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  challan_type: z.enum(["delivery", "job_work", "return"]).default("delivery"),
  returnable_type: z.enum(["returnable", "non_returnable"]).default("non_returnable"),
  from_location_id: z.string().uuid().optional().nullable(),
  to_location_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  vehicle_number: z.string().optional().nullable(),
  driver_name: z.string().optional().nullable(),
  transporter_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(ChallanItemSchema).min(1, "At least one item is required"),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("challans")
    .select(`
      id, challan_number, challan_date, challan_type, returnable_type, status,
      from_location_name, to_location_name, vehicle_number, notes, created_at,
      clients(id, name),
      from_location:from_location_id(id, name, type),
      to_location:to_location_id(id, name, type)
    `)
    .eq("user_id", ownerId)
    .order("challan_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorEmail, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create challans", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = ChallanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const {
    challan_number, challan_date, challan_type, returnable_type,
    from_location_id, to_location_id, client_id,
    vehicle_number, driver_name, transporter_name, notes, items,
  } = parsed.data;

  // Snapshot location names for resilience
  let fromLocationName: string | null = null;
  let toLocationName: string | null = null;

  if (from_location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", from_location_id)
      .eq("user_id", ownerId)
      .single();
    if (!loc) return NextResponse.json(apiError("From location not found", "NOT_FOUND"), { status: 404 });
    fromLocationName = loc.name;
  }

  if (to_location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", to_location_id)
      .eq("user_id", ownerId)
      .single();
    if (!loc) return NextResponse.json(apiError("To location not found", "NOT_FOUND"), { status: 404 });
    toLocationName = loc.name;
  }

  // Verify client if provided
  if (client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .eq("user_id", ownerId)
      .single();
    if (!client) return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
  }

  const { data: challan, error: cErr } = await supabase
    .from("challans")
    .insert({
      user_id: ownerId,
      challan_number,
      challan_date,
      challan_type,
      returnable_type,
      status: "draft",
      from_location_id: from_location_id || null,
      to_location_id: to_location_id || null,
      from_location_name: fromLocationName,
      to_location_name: toLocationName,
      client_id: client_id || null,
      vehicle_number: vehicle_number || null,
      driver_name: driver_name || null,
      transporter_name: transporter_name || null,
      notes: notes || null,
      created_by_email: actorEmail,
    })
    .select("id")
    .single();

  if (cErr || !challan) {
    if (cErr?.code === "23505") {
      return NextResponse.json(apiError("Challan number already exists", "CONFLICT"), { status: 409 });
    }
    return NextResponse.json(apiError(cErr?.message ?? "Failed to create challan", "INTERNAL_ERROR"), { status: 500 });
  }

  const itemRows = items.map((item, i) => ({
    challan_id: challan.id,
    product_id: item.product_id || null,
    description: item.description,
    hsn_sac_code: item.hsn_sac_code,
    quantity: item.quantity,
    unit: item.unit,
    remarks: item.remarks || null,
    sort_order: i,
  }));

  const { error: itemErr } = await supabase.from("challan_items").insert(itemRows);
  if (itemErr) {
    await supabase.from("challans").delete().eq("id", challan.id);
    return NextResponse.json(apiError(itemErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  return NextResponse.json(apiSuccess({ id: challan.id }), { status: 201 });
}
