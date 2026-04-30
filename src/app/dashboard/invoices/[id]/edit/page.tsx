import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";
import InvoiceForm from "@/components/invoice/InvoiceForm";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("invoices")
    .select("id, client_id, invoice_number, invoice_date, due_date, seller_state_code, notes, theme, invoice_line_items(*)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !data) notFound();

  return <InvoiceForm initialData={data} />;
}
