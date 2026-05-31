// Flat list of all active client branches for the authenticated user.
// Includes client_name via join — used to populate the EWB "Ship To" grouped dropdown.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("client_branches")
    .select("id, client_id, label, gstin, address, city, state_code, pincode, is_active, clients(name)")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .order("label");

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  // Flatten: pull client.name up
  const flat = (data ?? []).map((b) => ({
    id:         b.id,
    client_id:  b.client_id,
    label:      b.label,
    client_name: (b.clients as { name: string } | null)?.name ?? "",
    gstin:      b.gstin,
    address:    b.address,
    city:       b.city,
    state_code: b.state_code,
    pincode:    b.pincode,
  }));

  return NextResponse.json(apiSuccess(flat));
}
