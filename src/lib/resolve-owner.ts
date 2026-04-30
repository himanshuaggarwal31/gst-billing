import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnerContext = {
  /** The business owner's user ID — use for all data queries (user_id column) */
  ownerId: string;
  /** The logged-in user's ID — use for audit fields (created_by_user_id) */
  actorId: string;
  /** The logged-in user's email — use for audit fields (created_by_email) */
  actorEmail: string;
  role: "owner" | "viewer" | "editor";
  isDelegate: boolean;
};

/**
 * Resolves the effective owner for the logged-in user.
 *
 * If the user is a team member (invited via account_members), returns the
 * owner's ID so all data queries are scoped to the correct business.
 * Also auto-accepts pending invitations on first API call (lazy accept).
 *
 * If the user is a business owner themselves, returns their own ID.
 */
export async function resolveOwnerId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  userEmail: string
): Promise<OwnerContext> {
  // 1. Check if already linked by Supabase UID (fast path for subsequent logins)
  const { data: byId } = await supabase
    .from("account_members")
    .select("owner_id, role")
    .eq("member_user_id", userId)
    .maybeSingle();

  if (byId) {
    return {
      ownerId: byId.owner_id,
      actorId: userId,
      actorEmail: userEmail,
      role: byId.role as "viewer" | "editor",
      isDelegate: true,
    };
  }

  // 2. Check if invited by email but UID not yet linked (first login after invite)
  const { data: byEmail } = await supabase
    .from("account_members")
    .select("id, owner_id, role")
    .eq("member_email", userEmail)
    .is("member_user_id", null)
    .maybeSingle();

  if (byEmail) {
    // Auto-accept: link this user's Supabase UID to the invitation record
    await supabase
      .from("account_members")
      .update({
        member_user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", byEmail.id);

    return {
      ownerId: byEmail.owner_id,
      actorId: userId,
      actorEmail: userEmail,
      role: byEmail.role as "viewer" | "editor",
      isDelegate: true,
    };
  }

  // 3. User is a business owner — not a delegate of anyone
  return {
    ownerId: userId,
    actorId: userId,
    actorEmail: userEmail,
    role: "owner",
    isDelegate: false,
  };
}
