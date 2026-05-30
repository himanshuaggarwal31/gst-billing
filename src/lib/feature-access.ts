import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { FeatureAccessMap, FeatureId } from "./features";
import { FEATURE_IDS } from "./features";

// ── Service-role Supabase client (server-only, never sent to browser) ─────────
function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Super-admin check ─────────────────────────────────────────────────────────

/**
 * Returns true when the user is a Super Admin.
 * Resolution order:
 *  1. SUPER_ADMIN_EMAILS env var (bootstrapping — cannot be changed from DB)
 *  2. profiles.is_super_admin = true  (set by existing super admins via API)
 */
export async function isSuperAdmin(
  userId: string,
  userEmail: string
): Promise<boolean> {
  const envEmails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envEmails.includes(userEmail.toLowerCase())) return true;

  const admin = getAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();

  return data?.is_super_admin === true;
}

// ── Core resolution logic (uncached) ─────────────────────────────────────────

async function _resolveFeatureAccess(userId: string): Promise<FeatureAccessMap> {
  const admin = getAdminClient();

  // 1. Super admin shortcut → full unrestricted access
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin, email")
    .eq("id", userId)
    .maybeSingle();

  const envEmails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const superAdmin =
    profile?.is_super_admin === true ||
    (profile?.email && envEmails.includes(profile.email.toLowerCase()));

  if (superAdmin) {
    const allAccess: FeatureAccessMap = {};
    for (const id of FEATURE_IDS) {
      allAccess[id] = { enabled: true, limits: {}, source: "super_admin" };
    }
    return allAccess;
  }

  // 2. Fetch active subscription (latest active or trial)
  const now = new Date().toISOString();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan_id, status, trial_ends_at, expires_at")
    .eq("user_id", userId)
    .in("status", ["active", "trial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Determine effective plan (fall back to 'free' on expiry)
  let effectivePlanId = subscription?.plan_id ?? "free";
  if (subscription?.expires_at && new Date(subscription.expires_at) < new Date(now)) {
    effectivePlanId = "free";
  }
  if (
    subscription?.status === "trial" &&
    subscription?.trial_ends_at &&
    new Date(subscription.trial_ends_at) < new Date(now)
  ) {
    effectivePlanId = "free";
  }

  // 3. Build access map from plan features
  const { data: planFeatures } = await admin
    .from("plan_features")
    .select("feature_id, limits")
    .eq("plan_id", effectivePlanId);

  const accessMap: FeatureAccessMap = {};
  for (const pf of planFeatures ?? []) {
    accessMap[pf.feature_id as FeatureId] = {
      enabled: true,
      limits: pf.limits ?? {},
      source: "plan",
    };
  }

  // 4. Apply user-level overrides (Super Admin grants/revokes)
  const { data: overrides } = await admin
    .from("user_feature_overrides")
    .select("feature_id, is_enabled, limits, expires_at")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  for (const override of overrides ?? []) {
    const fid = override.feature_id as FeatureId;
    if (override.is_enabled) {
      accessMap[fid] = {
        enabled: true,
        // Prefer override limits; fall back to whatever the plan provided
        limits: override.limits ?? accessMap[fid]?.limits ?? {},
        source: "override",
        expiresAt: override.expires_at ?? null,
      };
    } else {
      // Force-disabled by Super Admin — remove from map entirely
      delete accessMap[fid];
    }
  }

  return accessMap;
}

// ── Cached variant (60-second TTL, tag-invalidated on admin changes) ──────────

/**
 * Returns the feature access map for a user, cached for up to 60 seconds.
 * Call `invalidateFeatureAccessCache(userId)` after any admin override change.
 */
export function resolveFeatureAccess(userId: string): Promise<FeatureAccessMap> {
  return unstable_cache(
    () => _resolveFeatureAccess(userId),
    [`feature-access:${userId}`],
    { revalidate: 60, tags: [`feature-access:${userId}`] }
  )();
}

// ── Cache invalidation ────────────────────────────────────────────────────────

/**
 * Call this from admin API routes after modifying overrides or subscriptions.
 * Requires next/cache (server-only).
 */
export async function invalidateFeatureAccessCache(userId: string): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (revalidateTag as any)(`feature-access:${userId}`);
}

// ── Per-route feature guard ───────────────────────────────────────────────────

/**
 * Convenience guard for API routes.
 * Returns `{ allowed: true, limits }` or `{ allowed: false, response }`.
 *
 * Usage:
 *   const guard = await requireFeature(ownerId, "invoices");
 *   if (!guard.allowed) return guard.response;
 *   const monthlyLimit = guard.limits["per_month"] ?? Infinity;
 */
export async function requireFeature(
  userId: string,
  featureId: FeatureId
): Promise<
  | { allowed: true;  limits: Record<string, number> }
  | { allowed: false; response: Response }
> {
  const accessMap = await resolveFeatureAccess(userId);
  const entry = accessMap[featureId];
  if (!entry?.enabled) {
    const { NextResponse } = await import("next/server");
    return {
      allowed:  false,
      response: NextResponse.json(
        { data: null, error: { message: `Feature '${featureId}' is not available on your plan.`, code: "FORBIDDEN" } },
        { status: 403 }
      ),
    };
  }
  return { allowed: true, limits: entry.limits ?? {} };
}

// ── Audit logging helper ──────────────────────────────────────────────────────

export type AuditAction =
  | "grant_feature"
  | "revoke_feature"
  | "update_override"
  | "change_plan"
  | "change_subscription_status"
  | "set_super_admin"
  | "revoke_super_admin";

export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  targetUserId?: string;
  targetEmail?: string;
  featureId?: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
}): Promise<void> {
  const admin = getAdminClient();
  await admin.from("feature_audit_logs").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    target_user_id: params.targetUserId ?? null,
    target_email: params.targetEmail ?? null,
    feature_id: params.featureId ?? null,
    action: params.action,
    old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
    new_value: params.newValue ? JSON.stringify(params.newValue) : null,
    reason: params.reason ?? null,
    ip_address: params.ipAddress ?? null,
  });
}
