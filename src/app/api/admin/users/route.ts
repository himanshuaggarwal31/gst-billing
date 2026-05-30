import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/feature-access";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Unauthorized" as const };
  const isAdmin = await isSuperAdmin(user.id, user.email!);
  if (!isAdmin) return { user: null, error: "Forbidden" as const };
  return { user, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// List all users with their profile, plan, and subscription status
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { searchParams } = new URL(request.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const search = searchParams.get("search") ?? "";
  const offset = (page - 1) * limit;

  const admin = getAdminClient();

  let query = admin
    .from("profiles")
    .select(
      `id, full_name, email, business_name, business_email, gstin, plan, is_super_admin, created_at`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,gstin.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error: dbError } = await query;
  if (dbError) return NextResponse.json(apiError(dbError.message, "INTERNAL_ERROR"), { status: 500 });

  return NextResponse.json(apiSuccess({ users: data, total: count, page, limit }));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users — placeholder (users are created via Supabase Auth)
// ─────────────────────────────────────────────────────────────────────────────
const SetSuperAdminSchema = z.object({
  userId:       z.string().uuid(),
  isSuperAdmin: z.boolean(),
  reason:       z.string().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const body = await request.json();
  const parsed = SetSuperAdminSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });

  const { userId, isSuperAdmin: makeAdmin, reason } = parsed.data;
  if (userId === user!.id) {
    return NextResponse.json(apiError("Cannot change your own super-admin status", "FORBIDDEN"), { status: 400 });
  }

  const admin = getAdminClient();

  const { data: target } = await admin.from("profiles").select("is_super_admin, email").eq("id", userId).maybeSingle();
  const oldValue = { is_super_admin: target?.is_super_admin };

  await admin.from("profiles").update({ is_super_admin: makeAdmin }).eq("id", userId);

  await admin.from("feature_audit_logs").insert({
    actor_id:       user!.id,
    actor_email:    user!.email!,
    target_user_id: userId,
    target_email:   target?.email ?? null,
    action:         makeAdmin ? "set_super_admin" : "revoke_super_admin",
    old_value:      oldValue,
    new_value:      { is_super_admin: makeAdmin },
    reason:         reason ?? null,
  });

  return NextResponse.json(apiSuccess({ success: true }));
}
