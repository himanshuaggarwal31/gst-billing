import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key server-side so RLS doesn't block profile/client joins
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up invoice by public_token
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`*, clients(*), invoice_line_items(*)`)
    .eq("public_token", token)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch seller profile (public data)
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, business_email, business_phone")
    .eq("id", invoice.user_id)
    .single();

  return NextResponse.json({ invoice, profile });
}
