import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

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
    .from("clients")
    .select("id, name, gstin, email, phone, address, city, state_code, pincode")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !data) return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiSuccess(data));
}

const ClientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  gstin: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().min(1).optional(),
  city: z.string().optional().nullable(),
  state_code: z.string().length(2).optional(),
  pincode: z.string().length(6).optional().nullable().or(z.literal("")),
});

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
    return NextResponse.json(apiError("Viewers cannot edit clients", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = ClientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  if (!data) return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
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
    return NextResponse.json(apiError("Viewers cannot delete clients", "FORBIDDEN"), { status: 403 });
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess({ deleted: true }));
}
