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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/[id]
// Full detail: profile + subscription + feature overrides
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { id } = await params;
  const admin = getAdminClient();

  const [profileRes, subscriptionRes, overridesRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).maybeSingle(),
    admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("user_feature_overrides")
      .select("*, features(name, module)")
      .eq("user_id", id),
  ]);

  if (!profileRes.data) return NextResponse.json(apiError("User not found", "NOT_FOUND"), { status: 404 });

  return NextResponse.json(
    apiSuccess({
      profile:       profileRes.data,
      subscriptions: subscriptionRes.data ?? [],
      overrides:     overridesRes.data ?? [],
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/[id]
// Upsert a feature override for the user
// ─────────────────────────────────────────────────────────────────────────────
const UpsertOverrideSchema = z.object({
  featureId:  z.string().min(1),
  isEnabled:  z.boolean(),
  limits:     z.record(z.string(), z.number()).nullable().optional(),
  reason:     z.string().nullable().optional(),
  expiresAt:  z.string().datetime({ offset: true }).nullable().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { id: targetUserId } = await params;
  const body = await request.json();
  const parsed = UpsertOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { featureId, isEnabled, limits, reason, expiresAt } = parsed.data;
  const admin = getAdminClient();

  // Capture old value for audit
  const { data: existing } = await admin
    .from("user_feature_overrides")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("feature_id", featureId)
    .maybeSingle();

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", targetUserId)
    .maybeSingle();

  const { error: upsertError } = await admin
    .from("user_feature_overrides")
    .upsert({
      user_id:    targetUserId,
      feature_id: featureId,
      is_enabled: isEnabled,
      limits:     limits ?? null,
      reason:     reason ?? null,
      expires_at: expiresAt ?? null,
      granted_by: user!.id,
    });

  if (upsertError) {
    return NextResponse.json(apiError(upsertError.message, "INTERNAL_ERROR"), { status: 500 });
  }

  // Audit log
  await writeAuditLog({
    actorId:       user!.id,
    actorEmail:    user!.email!,
    targetUserId,
    targetEmail:   targetProfile?.email,
    featureId,
    action:        existing ? "update_override" : (isEnabled ? "grant_feature" : "revoke_feature"),
    oldValue:      existing ?? null,
    newValue:      { featureId, isEnabled, limits, reason, expiresAt },
    reason:        reason ?? undefined,
  });

  // Invalidate cached access map for the target user
  await invalidateFeatureAccessCache(targetUserId);

  return NextResponse.json(apiSuccess({ success: true }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/[id]?featureId=xxx
// Remove a feature override (restoring plan-default behaviour)
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireSuperAdmin();
  if (error === "Unauthorized") return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  if (error === "Forbidden")    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });

  const { id: targetUserId } = await params;
  const { searchParams } = new URL(request.url);
  const featureId = searchParams.get("featureId");
  if (!featureId) {
    return NextResponse.json(apiError("featureId query param required", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getAdminClient();

  const { data: existing } = await admin
    .from("user_feature_overrides")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("feature_id", featureId)
    .maybeSingle();

  const { data: targetProfile } = await admin.from("profiles").select("email").eq("id", targetUserId).maybeSingle();

  await admin
    .from("user_feature_overrides")
    .delete()
    .eq("user_id", targetUserId)
    .eq("feature_id", featureId);

  await writeAuditLog({
    actorId:       user!.id,
    actorEmail:    user!.email!,
    targetUserId,
    targetEmail:   targetProfile?.email,
    featureId,
    action:        "update_override",
    oldValue:      existing ?? null,
    newValue:      null,
    reason:        "Override removed — reverted to plan default",
  });

  await invalidateFeatureAccessCache(targetUserId);

  return NextResponse.json(apiSuccess({ success: true }));
}
