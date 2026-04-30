import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const UpdateSchema = z.object({
  vendor_name: z.string().min(1).optional(),
  expense_date: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  amount: z.number().min(0).optional(),
  gst_rate: z.number().min(0).max(100).optional(),
  category: z.string().min(1).optional(),
  receipt_url: z.string().url().optional().nullable().or(z.literal("")),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit expenses", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.errors[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.amount !== undefined || parsed.data.gst_rate !== undefined) {
    // Fetch current to recalculate
    const { data: current } = await supabase
      .from("expenses")
      .select("amount, gst_rate")
      .eq("id", id)
      .eq("user_id", ownerId)
      .single();
    const amt = parsed.data.amount ?? current?.amount ?? 0;
    const rate = parsed.data.gst_rate ?? current?.gst_rate ?? 0;
    updates.gst_amount = Math.round(amt * rate) / 100;
    updates.total_amount = amt + (updates.gst_amount as number);
  }

  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot delete expenses", "FORBIDDEN"), { status: 403 });
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess({ id }));
}
