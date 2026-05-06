import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

// Simple CSV parser (handles quoted fields with commas)
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

// CSV template for clients
const CLIENT_TEMPLATE = `name,gstin,email,phone,address,city,state_code,pincode
Acme Corp,27AABCU9603R1ZX,acme@example.com,9876543210,"Plot 12, MIDC",Mumbai,27,400093
XYZ Services,,xyz@example.com,9123456789,"Sector 5, Noida",Noida,09,201301`;

export async function GET() {
  return new NextResponse(CLIENT_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="clients-import-template.csv"',
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

  // Map header columns
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const col = (name: string) => header.indexOf(name);

  const nameIdx      = col("name");
  const gstinIdx     = col("gstin");
  const emailIdx     = col("email");
  const phoneIdx     = col("phone");
  const addressIdx   = col("address");
  const cityIdx      = col("city");
  const stateCodeIdx = col("state_code");
  const pincodeIdx   = col("pincode");

  if (nameIdx === -1 || stateCodeIdx === -1) {
    return NextResponse.json(
      apiError("CSV must have 'name' and 'state_code' columns", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const toInsert = rows.slice(1).map((row) => ({
    user_id:    ownerId,
    name:       row[nameIdx] || "",
    gstin:      row[gstinIdx]     !== undefined ? row[gstinIdx]?.toUpperCase()     || null : null,
    email:      row[emailIdx]     !== undefined ? row[emailIdx]                    || null : null,
    phone:      row[phoneIdx]     !== undefined ? row[phoneIdx]                    || null : null,
    address:    row[addressIdx]   !== undefined ? row[addressIdx]                  || "" : "",
    city:       row[cityIdx]      !== undefined ? row[cityIdx]                     || null : null,
    state_code: (row[stateCodeIdx] || "").padStart(2, "0").slice(0, 2),
    pincode:    row[pincodeIdx]   !== undefined ? row[pincodeIdx]?.replace(/\D/g, "").slice(0, 6) || null : null,
  })).filter((r) => r.name);

  if (toInsert.length === 0) {
    return NextResponse.json(apiError("No valid rows found in CSV", "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(toInsert)
    .select("id, name");

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  return NextResponse.json(apiSuccess({ imported: data?.length ?? 0, rows: data }));
}
