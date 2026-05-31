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
