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

// invoice_number,invoice_date,due_date,client_name,client_gstin,
// description,hsn_sac_code,quantity,rate,discount_percent,gst_rate,payment_status,notes
const INVOICE_TEMPLATE = `invoice_number,invoice_date,due_date,client_name,client_gstin,seller_state_code,buyer_state_code,description,hsn_sac_code,quantity,rate,discount_percent,gst_rate,payment_status,notes
INV-001,2024-04-01,2024-04-15,Acme Corp,27AABCU9603R1ZX,27,27,Web Development,998314,1,50000,0,18,paid,Project A
INV-002,2024-04-05,,XYZ Services,,27,09,Laptop,8471,2,45000,5,18,pending,`;

export async function GET() {
  return new NextResponse(INVOICE_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="invoices-import-template.csv"',
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

  const invNumIdx        = col("invoice_number");
  const invDateIdx       = col("invoice_date");
  const dueDateIdx       = col("due_date");
  const clientNameIdx    = col("client_name");
  const clientGstinIdx   = col("client_gstin");
  const sellerStateIdx   = col("seller_state_code");
  const buyerStateIdx    = col("buyer_state_code");
  const descIdx          = col("description");
  const hsnIdx           = col("hsn_sac_code");
  const qtyIdx           = col("quantity");
  const rateIdx          = col("rate");
  const discIdx          = col("discount_percent");
  const gstRateIdx       = col("gst_rate");
  const statusIdx        = col("payment_status");
  const notesIdx         = col("notes");

  const required = [invNumIdx, invDateIdx, clientNameIdx, descIdx, hsnIdx, qtyIdx, rateIdx, gstRateIdx];
  if (required.some((i) => i === -1)) {
    return NextResponse.json(
      apiError(
        "CSV must have columns: invoice_number, invoice_date, client_name, description, hsn_sac_code, quantity, rate, gst_rate",
        "VALIDATION_ERROR"
      ),
      { status: 400 }
    );
  }

  // Fetch the owner's profile state_code to use as default when CSV rows don't specify it
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("state_code")
    .eq("id", ownerId)
    .single();
  // Default to owner's registered state; falls back to "27" (Maharashtra) if unset
  const defaultStateCode = ownerProfile?.state_code || "27";

  // Group rows by invoice_number (multiple rows = multiple line items)
  const invoiceMap = new Map<string, {
    invoice_number: string;
    invoice_date: string;
    due_date: string | null;
    client_name: string;
    client_gstin: string | null;
    seller_state_code: string;
    buyer_state_code: string;
    payment_status: string;
    notes: string | null;
    lines: Array<{
      description: string; hsn_sac_code: string;
      quantity: number; rate: number; discount_percent: number; gst_rate: number;
    }>;
  }>();

  for (const row of rows.slice(1)) {
    const invNum = row[invNumIdx]?.trim();
    if (!invNum) continue;

    if (!invoiceMap.has(invNum)) {
      invoiceMap.set(invNum, {
        invoice_number:    invNum,
        invoice_date:      row[invDateIdx] || new Date().toISOString().slice(0, 10),
        due_date:          dueDateIdx !== -1 ? row[dueDateIdx] || null : null,
        client_name:       row[clientNameIdx] || "",
        client_gstin:      clientGstinIdx !== -1 ? row[clientGstinIdx]?.toUpperCase() || null : null,
        seller_state_code: sellerStateIdx !== -1 ? (row[sellerStateIdx] || "").padStart(2, "0").slice(0, 2) : defaultStateCode,
        buyer_state_code:  buyerStateIdx !== -1 ? (row[buyerStateIdx] || "").padStart(2, "0").slice(0, 2) : defaultStateCode,
        payment_status:    statusIdx !== -1 ? (["paid", "pending", "partial"].includes(row[statusIdx]) ? row[statusIdx] : "pending") : "pending",
        notes:             notesIdx !== -1 ? row[notesIdx] || null : null,
        lines:             [],
      });
    }

    const qty      = parseFloat(row[qtyIdx]) || 1;
    const rate     = parseFloat(row[rateIdx]) || 0;
    const disc     = discIdx !== -1 ? parseFloat(row[discIdx]) || 0 : 0;
    const gstRate  = parseFloat(row[gstRateIdx]) || 0;

    invoiceMap.get(invNum)!.lines.push({
      description:      row[descIdx] || "",
      hsn_sac_code:     hsnIdx !== -1 ? row[hsnIdx] || "" : "",
      quantity:         qty,
      rate,
      discount_percent: disc,
      gst_rate:         gstRate,
    });
  }

  if (invoiceMap.size === 0) {
    return NextResponse.json(apiError("No valid invoice rows found", "VALIDATION_ERROR"), { status: 400 });
  }

  // Resolve or create clients for each unique client name
  const uniqueClients = [...new Set([...invoiceMap.values()].map((inv) => inv.client_name))];
  const clientMap = new Map<string, string>(); // name → client_id

  for (const clientName of uniqueClients) {
    if (!clientName) continue;
    // Try to find existing client
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", ownerId)
      .ilike("name", clientName)
      .maybeSingle();

    if (existing) {
      clientMap.set(clientName, existing.id);
    } else {
      // Find the invoice to get gstin/state_code
      const inv = [...invoiceMap.values()].find((i) => i.client_name === clientName);
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          user_id:    ownerId,
          name:       clientName,
          gstin:      inv?.client_gstin || null,
          address:    "",
          state_code: (inv?.buyer_state_code || defaultStateCode).padStart(2, "0").slice(0, 2),
        })
        .select("id")
        .single();
      if (newClient) clientMap.set(clientName, newClient.id);
    }
  }

  // Insert invoices one by one
  let imported = 0;
  const errors: string[] = [];

  for (const inv of invoiceMap.values()) {
    const clientId = clientMap.get(inv.client_name);
    if (!clientId) { errors.push(`Client not found for invoice ${inv.invoice_number}`); continue; }

    const sellerSC = inv.seller_state_code;
    const buyerSC  = inv.buyer_state_code;
    const isInterState = sellerSC !== buyerSC;

    // Compute totals from line items
    let taxableAmount = 0;
    let totalCgst = 0, totalSgst = 0, totalIgst = 0;

    const computedLines = inv.lines.map((line, idx) => {
      const gross = line.quantity * line.rate;
      const discAmt = gross * (line.discount_percent / 100);
      const taxable = parseFloat((gross - discAmt).toFixed(2));
      const cgst = isInterState ? 0 : parseFloat((taxable * line.gst_rate / 200).toFixed(2));
      const sgst = isInterState ? 0 : parseFloat((taxable * line.gst_rate / 200).toFixed(2));
      const igst = isInterState ? parseFloat((taxable * line.gst_rate / 100).toFixed(2)) : 0;
      const totalGst = cgst + sgst + igst;
      const lineTotal = taxable + totalGst;

      taxableAmount += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      return {
        user_id:          ownerId,
        description:      line.description,
        hsn_sac_code:     line.hsn_sac_code,
        quantity:         line.quantity,
        rate:             line.rate,
        discount_percent: line.discount_percent,
        gst_rate:         line.gst_rate,
        taxable_amount:   taxable,
        cgst,
        sgst,
        igst,
        total_gst:        totalGst,
        line_total:       lineTotal,
        sort_order:       idx,
      };
    });

    const totalGst    = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2));
    const totalAmount = parseFloat((taxableAmount + totalGst).toFixed(2));

    const { data: insertedInv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id:           ownerId,
        client_id:         clientId,
        invoice_number:    inv.invoice_number,
        invoice_date:      inv.invoice_date,
        due_date:          inv.due_date || null,
        seller_state_code: sellerSC,
        buyer_state_code:  buyerSC,
        taxable_amount:    parseFloat(taxableAmount.toFixed(2)),
        total_cgst:        totalCgst,
        total_sgst:        totalSgst,
        total_igst:        totalIgst,
        total_gst:         totalGst,
        total_amount:      totalAmount,
        payment_status:    inv.payment_status,
        notes:             inv.notes,
      })
      .select("id")
      .single();

    if (invErr || !insertedInv) {
      errors.push(`Invoice ${inv.invoice_number}: ${invErr?.message ?? "Insert failed"}`);
      continue;
    }

    await supabase.from("invoice_line_items").insert(
      computedLines.map((l) => ({ ...l, invoice_id: insertedInv.id }))
    );

    imported++;
  }

  return NextResponse.json(apiSuccess({ imported, total: invoiceMap.size, errors }));
}
