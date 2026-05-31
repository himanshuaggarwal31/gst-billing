import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChallanPDF } from "@/components/challan/ChallanPDF";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [{ data: challan, error: challanErr }, { data: profile }] = await Promise.all([
    supabase
      .from("challans")
      .select(`
        *,
        challan_items(*),
        clients(id, name, gstin, address, city, state_code),
        from_location:from_location_id(id, name, type, address),
        to_location:to_location_id(id, name, type, address)
      `)
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, email, phone, business_email, business_phone, pdf_accent_color")
      .eq("id", ownerId)
      .single(),
  ]);

  if (challanErr || !challan) return new NextResponse("Not found", { status: 404 });

  const pdfData = {
    challan_number:        challan.challan_number,
    challan_date:          challan.challan_date,
    challan_type:          challan.challan_type,
    returnable_type:       challan.returnable_type,
    status:                challan.status,
    notes:                 challan.notes ?? null,
    dispatched_at:         challan.dispatched_at ?? null,
    received_at:           challan.received_at ?? null,
    returned_at:           challan.returned_at ?? null,
    vehicle_number:        challan.vehicle_number ?? null,
    driver_name:           challan.driver_name ?? null,
    transporter_name:      challan.transporter_name ?? null,
    transporter_gstin:     challan.transporter_gstin ?? null,
    transport_mode:        challan.transport_mode ?? null,
    distance_km:           challan.distance_km ?? null,
    eway_bill_number:      challan.eway_bill_number ?? null,
    eway_bill_valid_until: challan.eway_bill_valid_until ?? null,
    from_location_name:    challan.from_location_name ?? null,
    to_location_name:      challan.to_location_name ?? null,
    from_location:         challan.from_location ?? null,
    to_location:           challan.to_location ?? null,
    clients:               challan.clients ?? null,
    challan_items:         (challan.challan_items ?? []).map((item: {
      description: string; hsn_sac_code: string; quantity: number;
      unit: string; remarks: string | null; sort_order: number;
    }) => ({
      description:   item.description,
      hsn_sac_code:  item.hsn_sac_code,
      quantity:      item.quantity,
      unit:          item.unit,
      remarks:       item.remarks ?? null,
      sort_order:    item.sort_order,
    })),
    seller: {
      business_name:  profile?.business_name ?? "Business",
      gstin:          profile?.gstin ?? null,
      address:        profile?.address ?? null,
      city:           profile?.city ?? null,
      state_code:     profile?.state_code ?? null,
      pincode:        profile?.pincode ?? null,
      phone:          profile?.phone ?? null,
      business_phone: profile?.business_phone ?? null,
      business_email: profile?.business_email ?? null,
    },
    accent_color: profile?.pdf_accent_color ?? null,
  };

  const buffer = await renderToBuffer(createElement(ChallanPDF, { data: pdfData }));

  const safeNumber = challan.challan_number.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="challan-${safeNumber}.pdf"`,
    },
  });
}
