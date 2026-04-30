import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor"]).default("viewer"),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const { data, error } = await supabase
    .from("account_members")
    .select("id, member_email, role, invited_at, accepted_at")
    .eq("owner_id", user.id)
    .order("invited_at", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const body = await req.json();
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.errors[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  // Don't allow inviting yourself
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser?.email === parsed.data.email) {
    return NextResponse.json(apiError("Cannot invite yourself", "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("account_members")
    .insert({
      owner_id: user.id,
      member_email: parsed.data.email,
      role: parsed.data.role,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(apiError("This email is already invited", "CONFLICT"), { status: 409 });
    }
    return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  }
  return NextResponse.json(apiSuccess(data), { status: 201 });
}
