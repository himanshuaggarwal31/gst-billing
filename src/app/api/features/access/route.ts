import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveFeatureAccess } from "@/lib/feature-access";

import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * GET /api/features/access
 * Returns the complete feature access map for the currently authenticated user.
 * Used by the frontend context to gate UI elements.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  }

  const accessMap = await resolveFeatureAccess(user.id);
  return NextResponse.json(apiSuccess(accessMap));
}
