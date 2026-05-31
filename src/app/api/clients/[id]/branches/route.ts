import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const BranchSchema = z.object({
  label:      z.string().min(1, "Branch label is required").max(100),
  gstin:      z.string().optional().nullable(),
  address:    z.string().optional().nullable(),
  city:       z.string().optional().nullable(),
  state_code: z.string().length(2).optional().nullable(),
  pincode:    z.string().length(6).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("client_branches")
    .select("id, client_id, label, gstin, address, city, state_code, pincode, is_active, created_at")
    .eq("user_id", ownerId)
    .eq("client_id", clientId)
    .order("label");

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create branches", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = BranchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { label, gstin, address, city, state_code, pincode } = parsed.data;
  const { data, error } = await supabase
    .from("client_branches")
    .insert({
      user_id:    ownerId,
      client_id:  clientId,
      label,
      gstin:      gstin      || null,
      address:    address    || null,
      city:       city       || null,
      state_code: state_code || null,
      pincode:    pincode    || null,
    })
    .select("id, client_id, label, gstin, address, city, state_code, pincode, is_active")
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data), { status: 201 });
}
