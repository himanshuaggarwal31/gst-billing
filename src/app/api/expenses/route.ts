import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const ExpenseSchema = z.object({
  vendor_name: z.string().min(1, "Vendor name is required"),
  expense_date: z.string().min(1, "Date is required"),
  description: z.string().optional().nullable(),
  amount: z.number().min(0),
  gst_rate: z.number().min(0).max(100).default(18),
  category: z.string().min(1).default("General"),
  receipt_url: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", ownerId)
    .order("expense_date", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create expenses", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = ExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.errors[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { amount, gst_rate } = parsed.data;
  const gst_amount = Math.round(amount * gst_rate) / 100;
  const total_amount = amount + gst_amount;

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...parsed.data,
      user_id: ownerId,
      gst_amount,
      total_amount,
      receipt_url: parsed.data.receipt_url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data), { status: 201 });
}
