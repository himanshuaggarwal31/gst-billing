import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";

// GSTR-1 B2B CSV — matches GST portal upload format
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data: profile } = await supabase
    .from("profiles")
    .select("gstin, business_name")
    .eq("id", ownerId)
    .single();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      invoice_number, invoice_date, total_amount, taxable_amount,
      total_cgst, total_sgst, total_igst, total_gst, is_inter_state,
      seller_state_code, buyer_state_code,
      clients(name, gstin, state_code)
    `)
    .eq("user_id", ownerId)
    .neq("payment_status", "draft")
    .order("invoice_date", { ascending: true });

  if (error) return new NextResponse("Error fetching invoices", { status: 500 });

  const rows: string[][] = [];

  // B2B header (registered buyers with GSTIN)
  rows.push(["B2B Invoices"]);
  rows.push([
    "GSTIN of Supplier", "Trade/Legal Name of Supplier",
    "GSTIN of Recipient", "Receiver Name",
    "Invoice Number", "Invoice Date", "Invoice Value",
    "Place of Supply", "Reverse Charge", "Invoice Type",
    "Rate", "Taxable Value", "IGST", "CGST", "SGST/UTGST",
  ]);

  const b2b = invoices?.filter((i) => (i.clients as { gstin: string | null })?.gstin) ?? [];
  const b2c = invoices?.filter((i) => !(i.clients as { gstin: string | null })?.gstin) ?? [];

  for (const inv of b2b) {
    const client = inv.clients as { name: string; gstin: string | null; state_code: string };
    rows.push([
      profile?.gstin ?? "",
      profile?.business_name ?? "",
      client.gstin ?? "",
      client.name,
      inv.invoice_number,
      inv.invoice_date,
      String(inv.total_amount),
      client.state_code,
      "N",
      inv.is_inter_state ? "IGST" : "Regular",
      "",
      String(inv.taxable_amount),
      String(inv.total_igst),
      String(inv.total_cgst),
      String(inv.total_sgst),
    ]);
  }

  rows.push([]);
  rows.push(["B2C (Unregistered) Invoices"]);
  rows.push([
    "GSTIN of Supplier", "Trade/Legal Name of Supplier",
    "Receiver Name", "Invoice Number", "Invoice Date",
    "Invoice Value", "Place of Supply",
    "Taxable Value", "IGST", "CGST", "SGST/UTGST",
  ]);

  for (const inv of b2c) {
    const client = inv.clients as { name: string; state_code: string };
    rows.push([
      profile?.gstin ?? "",
      profile?.business_name ?? "",
      client.name,
      inv.invoice_number,
      inv.invoice_date,
      String(inv.total_amount),
      client.state_code,
      String(inv.taxable_amount),
      String(inv.total_igst),
      String(inv.total_cgst),
      String(inv.total_sgst),
    ]);
  }

  // Encode as CSV
  const csv = rows
    .map((row) =>
      row.map((cell) => (cell.includes(",") || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")
    )
    .join("\r\n");

  const month = new Date().toISOString().slice(0, 7);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="GSTR1_${month}.csv"`,
    },
  });
}
