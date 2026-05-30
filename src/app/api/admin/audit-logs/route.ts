import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/feature-access";
import { apiSuccess, apiError } from "@/lib/api-response";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * GET /api/admin/audit-logs
 * Paginated audit log — supports filtering by target user, action, and date range.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const isAdmin = await isSuperAdmin(user.id, user.email!);
  if (!isAdmin) return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { searchParams } = new URL(request.url);
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit        = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const targetUserId = searchParams.get("targetUserId");
  const action       = searchParams.get("action");
  const from         = searchParams.get("from");
  const to           = searchParams.get("to");
  const offset       = (page - 1) * limit;

  const admin = getAdminClient();

  let query = admin
    .from("feature_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (targetUserId) query = query.eq("target_user_id", targetUserId);
  if (action)       query = query.eq("action", action);
  if (from)         query = query.gte("created_at", from);
  if (to)           query = query.lte("created_at", to);

  const { data, count, error } = await query;
  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  return NextResponse.json(apiSuccess({ logs: data, total: count, page, limit }));
}
