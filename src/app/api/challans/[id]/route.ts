import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const StatusSchema = z.object({
  status: z.enum(["draft", "dispatched", "received", "returned"]),
});

const EWBSchema = z.object({
  eway_bill_number:     z.string().optional().nullable(),
  eway_bill_valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  transport_mode:       z.enum(["road", "rail", "air", "ship"]).optional().nullable(),
  distance_km:          z.number().int().min(0).optional().nullable(),
  transporter_gstin:    z.string().optional().nullable(),
});

const EditSchema = z.object({
  challan_number:  z.string().min(1),
  challan_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  challan_type:    z.enum(["delivery", "job_work", "return"]),
  returnable_type: z.enum(["returnable", "non_returnable"]),
  from_location_id: z.string().uuid().optional().nullable(),
  to_location_id:   z.string().uuid().optional().nullable(),
  client_id:        z.string().uuid().optional().nullable(),
  vehicle_number:   z.string().optional().nullable(),
  driver_name:      z.string().optional().nullable(),
  transporter_name: z.string().optional().nullable(),
  notes:            z.string().optional().nullable(),
  items: z.array(z.object({
    product_id:   z.string().uuid().optional().nullable(),
    description:  z.string().min(1),
    hsn_sac_code: z.string().optional().nullable(),
    quantity:     z.number().positive(),
    unit:         z.string(),
    remarks:      z.string().optional().nullable(),
  })).min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("challans")
    .select(`
      *,
      clients(id, name, gstin, address, city, state_code),
      from_location:from_location_id(id, name, type, address),
      to_location:to_location_id(id, name, type, address),
      challan_items(*, products(id, name))
    `)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !data) return NextResponse.json(apiError("Challan not found", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiSuccess(data));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit challans", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();

  // Route to appropriate update: status change OR EWB details update
  if ("status" in body) {
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
    }

    const now = new Date().toISOString();
    const timestampField: Record<string, string> = {
      dispatched: "dispatched_at",
      received: "received_at",
      returned: "returned_at",
    };

    const updatePayload: Record<string, string> = {
      status: parsed.data.status,
      updated_at: now,
    };
    const tsField = timestampField[parsed.data.status];
    if (tsField) updatePayload[tsField] = now;

    const { data, error } = await supabase
      .from("challans")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", ownerId)
      .select()
      .single();

    if (error || !data) return NextResponse.json(apiError("Challan not found", "NOT_FOUND"), { status: 404 });
    return NextResponse.json(apiSuccess(data));
  }

  // EWB details update
  const parsed = EWBSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("challans")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error || !data) return NextResponse.json(apiError("Challan not found", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiSuccess(data));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit challans", "FORBIDDEN"), { status: 403 });
  }

  // Only draft challans can be fully edited
  const { data: existing } = await supabase
    .from("challans")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (!existing) return NextResponse.json(apiError("Challan not found", "NOT_FOUND"), { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json(apiError("Only draft challans can be edited", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { items, ...challanFields } = parsed.data;

  // Update challan header
  const { data: updated, error: updateErr } = await supabase
    .from("challans")
    .update({ ...challanFields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(apiError(updateErr?.message ?? "Update failed", "INTERNAL_ERROR"), { status: 500 });
  }

  // Replace items: delete existing, insert new
  const { error: deleteErr } = await supabase
    .from("challan_items")
    .delete()
    .eq("challan_id", id);

  if (deleteErr) {
    return NextResponse.json(apiError(deleteErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  const newItems = items.map((item, idx) => ({
    challan_id:   id,
    user_id:      ownerId,
    sort_order:   idx + 1,
    product_id:   item.product_id   ?? null,
    description:  item.description,
    hsn_sac_code: item.hsn_sac_code ?? "",
    quantity:     item.quantity,
    unit:         item.unit,
    remarks:      item.remarks       ?? null,
  }));

  const { error: insertErr } = await supabase
    .from("challan_items")
    .insert(newItems);

  if (insertErr) {
    return NextResponse.json(apiError(insertErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  return NextResponse.json(apiSuccess(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot delete challans", "FORBIDDEN"), { status: 403 });
  }

  const { error } = await supabase
    .from("challans")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess({ deleted: true }));
}
