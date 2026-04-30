import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

function buildEmailHtml(params: {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  appUrl: string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#1a56db;padding:24px 32px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:bold">${params.businessName}</p>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Tax Invoice</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;font-size:15px;color:#111">Hi ${params.clientName},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#444;line-height:1.6">
              Please find attached your invoice from <strong>${params.businessName}</strong>.
              The details are below:
            </p>
            <!-- Invoice details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:6px;margin-bottom:24px">
              <tr>
                <td style="padding:16px 20px">
                  <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b7280;width:140px">Invoice Number</td>
                      <td style="font-size:13px;color:#111;font-weight:bold">${params.invoiceNumber}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280">Invoice Date</td>
                      <td style="font-size:13px;color:#111">${fmtDate(params.invoiceDate)}</td>
                    </tr>
                    ${params.dueDate ? `<tr>
                      <td style="font-size:13px;color:#6b7280">Due Date</td>
                      <td style="font-size:13px;color:#dc2626;font-weight:bold">${fmtDate(params.dueDate)}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-top:8px;border-top:1px solid #e5e7eb">Total Amount</td>
                      <td style="font-size:16px;color:#1a56db;font-weight:bold;padding-top:8px;border-top:1px solid #e5e7eb">${fmt(params.totalAmount)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:13px;color:#6b7280">
              The invoice PDF is attached to this email. Please retain it for your records.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e5e7eb;background:#f9fafb">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
              Sent via ${params.businessName} · Powered by GST Billing
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_key") {
    return NextResponse.json(
      apiError("Resend API key not configured", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  // Fetch invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(`*, clients(*), invoice_line_items(*)`)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });
  }

  if (!invoice.clients?.email) {
    return NextResponse.json(
      apiError("Client has no email address", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, gstin, address, city, state_code, pincode, email, phone, pan, logo_url, pdf_status_style, business_email, business_phone")
    .eq("id", ownerId)
    .single();

  const businessName = profile?.business_name || "My Business";

  const pdfData = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    payment_status: invoice.payment_status,
    pdf_status_style: (profile?.pdf_status_style ?? "stamp") as "stamp" | "badge" | "none",
    notes: invoice.notes,
    theme: invoice.theme ?? "classic",
    seller_state_code: invoice.seller_state_code,
    buyer_state_code: invoice.buyer_state_code,
    is_inter_state: invoice.is_inter_state,
    taxable_amount: invoice.taxable_amount,
    total_cgst: invoice.total_cgst,
    total_sgst: invoice.total_sgst,
    total_igst: invoice.total_igst,
    total_gst: invoice.total_gst,
    total_amount: invoice.total_amount,
    seller: {
      business_name: businessName,
      gstin: profile?.gstin ?? null,
      address: profile?.address ?? null,
      city: profile?.city ?? null,
      state_code: profile?.state_code ?? null,
      pincode: profile?.pincode ?? null,
      email: profile?.business_email || profile?.email || user.email || "",
      phone: (profile?.business_phone || profile?.phone) ?? null,
      pan: profile?.pan ?? null,
      logo_url: profile?.logo_url ?? null,
    },
    client: invoice.clients,
    line_items: invoice.invoice_line_items,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData }));
  } catch (pdfErr) {
    console.error("[email] PDF render failed:", pdfErr);
    return NextResponse.json(
      apiError("Failed to generate PDF: " + String(pdfErr), "INTERNAL_ERROR"),
      { status: 500 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { data: emailData, error: emailErr } = await resend.emails.send({
    from: `${businessName} <${fromAddress}>`,
    to: invoice.clients.email,
    subject: `Invoice #${invoice.invoice_number} from ${businessName}`,
    html: buildEmailHtml({
      clientName: invoice.clients.name,
      businessName,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }),
    attachments: [
      {
        filename: `invoice-${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (emailErr) {
    console.error("[email] Resend error:", JSON.stringify(emailErr));
    return NextResponse.json(apiError(emailErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  console.log("[email] Sent successfully, id:", emailData?.id);
  return NextResponse.json(apiSuccess({ sent: true, to: invoice.clients.email }));
}
