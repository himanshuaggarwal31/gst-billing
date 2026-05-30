import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const TemplateSchema = z.object({
  name: z.string().min(1),
  client_id: z.string().uuid(),
  seller_state_code: z.string().length(2),
  notes: z.string().optional().nullable(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  next_run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoice_number_prefix: z.string().min(1).default("REC-"),
  line_items: z.array(z.object({
    description: z.string().min(1),
    hsn_sac_code: z.string(),
    quantity: z.number().positive(),
    rate: z.number().positive(),
    gst_rate: z.number().min(0),
    discount_percent: z.number().min(0).max(100).default(0),
  })).min(1),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("recurring_templates")
    .select("*, clients(name)")
    .eq("user_id", ownerId)
    .order("next_run_date", { ascending: true });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create templates", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = TemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("recurring_templates")
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data), { status: 201 });
}
