import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.filter((l) => l.trim() !== "").map((line) => {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  });
}

const PRODUCT_TEMPLATE = `name,description,hsn_sac_code,is_service,default_rate,gst_rate,sku,purchase_rate,cess_rate
Laptop,15.6 inch laptop,8471,N,45000,18,LAP-001,38000,0
Web Design Service,Website design & development,998314,Y,15000,18,SRV-WEB,,0
Office Chair,,9401,N,8000,18,CHR-001,6000,0`;

export async function GET() {
  return new NextResponse(PRODUCT_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="products-import-template.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot import data", "FORBIDDEN"), { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json(apiError("No file uploaded", "VALIDATION_ERROR"), { status: 400 });

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json(apiError("CSV must have a header row and at least one data row", "VALIDATION_ERROR"), { status: 400 });
  }

  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const col = (name: string) => header.indexOf(name);

  const nameIdx         = col("name");
  const descIdx         = col("description");
  const hsnIdx          = col("hsn_sac_code");
  const isServiceIdx    = col("is_service");
  const rateIdx         = col("default_rate");
  const gstRateIdx      = col("gst_rate");
  const skuIdx          = col("sku");
  const purchaseRateIdx = col("purchase_rate");
  const cessRateIdx     = col("cess_rate");

  if (nameIdx === -1 || hsnIdx === -1) {
    return NextResponse.json(
      apiError("CSV must have 'name' and 'hsn_sac_code' columns", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const toInsert = rows.slice(1).map((row) => ({
    user_id:       ownerId,
    name:          row[nameIdx] || "",
    description:   descIdx !== -1 ? row[descIdx] || null : null,
    hsn_sac_code:  hsnIdx !== -1 ? row[hsnIdx] || "" : "",
    is_service:    isServiceIdx !== -1 ? row[isServiceIdx]?.toUpperCase() === "Y" : false,
    default_rate:  rateIdx !== -1 ? parseFloat(row[rateIdx]) || 0 : 0,
    gst_rate:      gstRateIdx !== -1 ? parseFloat(row[gstRateIdx]) || 0 : 0,
    sku:           skuIdx !== -1 ? row[skuIdx] || null : null,
    purchase_rate: purchaseRateIdx !== -1 ? parseFloat(row[purchaseRateIdx]) || null : null,
    cess_rate:     cessRateIdx !== -1 ? parseFloat(row[cessRateIdx]) || 0 : 0,
  })).filter((r) => r.name);

  if (toInsert.length === 0) {
    return NextResponse.json(apiError("No valid rows found in CSV", "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert(toInsert)
    .select("id, name");

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  return NextResponse.json(apiSuccess({ imported: data?.length ?? 0, rows: data }));
}
