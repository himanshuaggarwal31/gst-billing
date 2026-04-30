import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });
  }

  const client = invoice.clients as { name: string; email: string | null };
  if (!client?.email) {
    return NextResponse.json(
      apiError("Client has no email address", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, phone")
    .eq("id", user.id)
    .single();

  const businessName = profile?.business_name ?? "Our Team";
  const daysOverdue = invoice.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
    : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const subject = daysOverdue && daysOverdue > 0
    ? `Payment Reminder — Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
    : `Friendly Reminder — Invoice ${invoice.invoice_number} is due`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1a56db">Payment Reminder</h2>
      <p>Dear ${client.name},</p>
      <p>This is a friendly reminder that the following invoice is ${daysOverdue && daysOverdue > 0 ? `<strong>${daysOverdue} days overdue</strong>` : "due for payment"}.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f3f4f6">
          <td style="padding:8px 12px;font-weight:bold">Invoice Number</td>
          <td style="padding:8px 12px">${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold">Invoice Date</td>
          <td style="padding:8px 12px">${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</td>
        </tr>
        ${invoice.due_date ? `<tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:bold">Due Date</td><td style="padding:8px 12px">${new Date(invoice.due_date).toLocaleDateString("en-IN")}</td></tr>` : ""}
        <tr ${daysOverdue && daysOverdue > 0 ? 'style="background:#fef2f2"' : ""}>
          <td style="padding:8px 12px;font-weight:bold">Amount Due</td>
          <td style="padding:8px 12px;font-weight:bold;color:#dc2626">${fmt(invoice.total_amount)}</td>
        </tr>
      </table>
      <p>Please arrange payment at the earliest convenience. If you have any questions, feel free to reach out${profile?.phone ? ` at ${profile.phone}` : ""}.</p>
      <p>Thank you for your business.</p>
      <p>Warm regards,<br/><strong>${businessName}</strong></p>
    </div>
  `;

  const { error: emailErr } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: client.email,
    subject,
    html,
  });

  if (emailErr) {
    return NextResponse.json(apiError(emailErr.message, "EMAIL_ERROR"), { status: 500 });
  }

  return NextResponse.json(apiSuccess({ sent: true }));
}
