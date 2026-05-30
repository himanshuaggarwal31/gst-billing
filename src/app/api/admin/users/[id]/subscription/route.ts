import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin, invalidateFeatureAccessCache, writeAuditLog } from "@/lib/feature-access";
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

const SubscriptionSchema = z.object({
  planId:       z.string().min(1),
  status:       z.enum(["active", "trial", "cancelled", "expired", "past_due"]),
  expiresAt:    z.string().datetime({ offset: true }).nullable().optional(),
  trialEndsAt:  z.string().datetime({ offset: true }).nullable().optional(),
  notes:        z.string().nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/[id]/subscription
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { id } = await params;
  const admin = getAdminClient();

  const { data, error: dbError } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json(apiError(dbError.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/[id]/subscription
// Create a new subscription for the user (e.g., upgrade their plan)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { id: targetUserId } = await params;
  const body = await request.json();
  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { planId, status, expiresAt, trialEndsAt, notes } = parsed.data;
  const admin = getAdminClient();

  // Fetch current active subscription for audit
  const { data: current } = await admin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", targetUserId)
    .in("status", ["active", "trial"])
    .maybeSingle();

  const { data: targetProfile } = await admin.from("profiles").select("email").eq("id", targetUserId).maybeSingle();

  // Cancel any existing active/trial subscriptions
  await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("user_id", targetUserId)
    .in("status", ["active", "trial"]);

  // Insert the new subscription (trigger will sync profiles.plan)
  const { error: insertError } = await admin.from("subscriptions").insert({
    user_id:       targetUserId,
    plan_id:       planId,
    status,
    expires_at:    expiresAt ?? null,
    trial_ends_at: trialEndsAt ?? null,
    notes:         notes ?? null,
    created_by:    user!.id,
  });

  if (insertError) {
    return NextResponse.json(apiError(insertError.message, "INTERNAL_ERROR"), { status: 500 });
  }

  await writeAuditLog({
    actorId:       user!.id,
    actorEmail:    user!.email!,
    targetUserId,
    targetEmail:   targetProfile?.email,
    action:        "change_plan",
    oldValue:      current ?? { plan_id: "free", status: "active" },
    newValue:      { planId, status, expiresAt, trialEndsAt },
    reason:        notes ?? undefined,
  });

  await invalidateFeatureAccessCache(targetUserId);

  return NextResponse.json(apiSuccess({ success: true }));
}
