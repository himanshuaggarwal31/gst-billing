import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

const ProfileSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  gstin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state_code: z.string().length(2, "State code must be 2 digits").optional().nullable().or(z.literal("")),
  pincode: z.string().length(6).optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
  pdf_status_style: z.enum(["stamp", "badge", "none"]).optional().nullable(),
  business_email: z.string().email().optional().nullable().or(z.literal("")),
  business_phone: z.string().optional().nullable(),
  pdf_theme: z.enum(["classic", "minimal", "modern"]).optional().nullable(),
  pdf_accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex colour").optional().nullable().or(z.literal("")),
  pdf_footer_text: z.string().optional().nullable(),
  pdf_footer_text_invoice: z.string().optional().nullable(),
  pdf_footer_text_quotation: z.string().optional().nullable(),
  pdf_footer_text_ewb: z.string().optional().nullable(),
  pdf_terms: z.string().optional().nullable(),
  pdf_show_amount_in_words: z.boolean().optional().nullable(),
  pdf_print_copies: z.boolean().optional().nullable(),
  pdf_copy_labels: z.array(z.string().max(50)).max(5).optional().nullable(),
  invoice_prefix: z.string().min(1).max(20).optional().nullable(),
  quotation_prefix: z.string().min(1).max(20).optional().nullable(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, plan, invoice_count_this_month, pdf_status_style, business_email, business_phone, pdf_theme, pdf_accent_color, pdf_footer_text, pdf_footer_text_invoice, pdf_footer_text_quotation, pdf_footer_text_ewb, pdf_terms, pdf_show_amount_in_words, pdf_print_copies, pdf_copy_labels, invoice_prefix, quotation_prefix")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const body = await req.json();
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}
