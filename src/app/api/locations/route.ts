import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const LocationSchema = z.object({
  name: z.string().min(1, "Location name is required").max(100),
  type: z.enum(["warehouse", "project_site", "other"]).default("warehouse"),
  address: z.string().optional().nullable(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, type, address, is_active, created_at")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create locations", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = LocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { name, type, address } = parsed.data;
  const { data, error } = await supabase
    .from("locations")
    .insert({ user_id: ownerId, name, type, address: address || null })
    .select("id, name, type, address, is_active")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(apiError("A location with this name already exists", "CONFLICT"), { status: 409 });
    }
    return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  }

  return NextResponse.json(apiSuccess(data), { status: 201 });
}
