import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";

// IRP-mandated placeholder pincode for addresses where pincode is missing/unknown
const PLACEHOLDER_PINCODE = 999999;

function nicDate(dateStr: string): string {
  // NIC IRP portal expects DD/MM/YYYY
  const d = new Date(dateStr);
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(*), invoice_line_items(*)")
      .eq("id", id)
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("profiles")
      .select("business_name, gstin, address, city, state_code, pincode, phone, business_email")
      .eq("id", ownerId)
      .single(),
  ]);

  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });

  const client = invoice.clients as {
    name: string; gstin: string | null; address: string | null;
    city: string | null; state_code: string; pincode: string | null;
    phone: string | null; email: string | null;
  };

  const sellerStateCode = (profile?.state_code ?? invoice.seller_state_code ?? "0").trim();
  const buyerStateCode  = (client.state_code ?? "0").trim();
  const isInterState    = sellerStateCode !== buyerStateCode;

  const lineItems = (invoice.invoice_line_items as Array<{
    description: string; hsn_sac_code: string;
    quantity: number; rate: number; discount_percent: number;
    gst_rate: number; taxable_amount: number; total_gst: number; line_total: number; sort_order: number;
  }>)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, idx) => {
      const isService = item.hsn_sac_code?.startsWith("99");
      const cgstRate  = isInterState ? 0 : item.gst_rate / 2;
      const sgstRate  = isInterState ? 0 : item.gst_rate / 2;
      const igstRate  = isInterState ? item.gst_rate : 0;
      const cgstAmt   = parseFloat(((item.taxable_amount * cgstRate) / 100).toFixed(2));
      const sgstAmt   = parseFloat(((item.taxable_amount * sgstRate) / 100).toFixed(2));
      const igstAmt   = parseFloat(((item.taxable_amount * igstRate) / 100).toFixed(2));
      const discAmt   = parseFloat(((item.rate * item.quantity * item.discount_percent) / 100).toFixed(2));

      return {
        SlNo:           String(idx + 1),
        PrdDesc:        item.description.slice(0, 300),
        IsServc:        isService ? "Y" : "N",
        HsnCd:          item.hsn_sac_code || "9997",
        Qty:            item.quantity,
        Unit:           isService ? "OTH" : "NOS",
        UnitPrice:      item.rate,
        TotAmt:         parseFloat((item.rate * item.quantity).toFixed(2)),
        Discount:       discAmt,
        AssAmt:         item.taxable_amount,
        GstRt:          item.gst_rate,
        IgstAmt:        igstAmt,
        CgstAmt:        cgstAmt,
        SgstAmt:        sgstAmt,
        CesRt:          0,
        CesAmt:         0,
        CesNonAdvolAmt: 0,
        TotItemVal:     item.line_total,
      };
    });

  // Supply type: B2B if buyer has GSTIN, else B2C
  const supplyType = client.gstin ? "B2B" : "B2C";

  const nicJson = {
    Version: "1.1",
    TranDtls: {
      TaxSch:      "GST",
      SupTyp:      supplyType,
      RegRev:      "N",
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: "INV",
      No:  invoice.invoice_number,
      Dt:  nicDate(invoice.invoice_date),
    },
    SellerDtls: {
      Gstin: profile?.gstin || "URP",
      LglNm: profile?.business_name || "",
      TrdNm: profile?.business_name || "",
      Addr1: (profile?.address || "").slice(0, 100),
      Addr2: "",
      Loc:   profile?.city || "",
      // IRP requires a valid 6-digit pincode; PLACEHOLDER_PINCODE is the placeholder for missing/unknown
      Pin:   parseInt(profile?.pincode ?? "", 10) || PLACEHOLDER_PINCODE,
      Stcd:  sellerStateCode,
      Ph:    (profile?.phone || "").replace(/\D/g, "").slice(0, 10),
      Em:    (profile?.business_email || "").slice(0, 100),
    },
    BuyerDtls: {
      Gstin: client.gstin || "URP",
      LglNm: client.name,
      TrdNm: client.name,
      Pos:   buyerStateCode,
      Addr1: (client.address || "").slice(0, 100),
      Addr2: "",
      Loc:   client.city || "",
      // IRP requires a valid 6-digit pincode; PLACEHOLDER_PINCODE is the placeholder for missing/unknown
      Pin:   parseInt(client.pincode ?? "", 10) || PLACEHOLDER_PINCODE,
      Stcd:  buyerStateCode,
      Ph:    (client.phone || "").replace(/\D/g, "").slice(0, 10),
      Em:    (client.email || "").slice(0, 100),
    },
    ItemList: lineItems,
    ValDtls: {
      AssVal:      invoice.taxable_amount,
      CgstVal:     invoice.total_cgst,
      SgstVal:     invoice.total_sgst,
      IgstVal:     invoice.total_igst,
      CesVal:      0,
      StCesVal:    0,
      Discount:    0,
      OthChrg:     0,
      RndOffAmt:   0,
      TotInvVal:   invoice.total_amount,
    },
  };

  return new NextResponse(JSON.stringify(nicJson, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="einvoice-${invoice.invoice_number}.json"`,
    },
  });
}
