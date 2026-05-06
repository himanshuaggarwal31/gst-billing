import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { PLAN_CONFIG } from "@/lib/plan-config";
const FREE_LIMIT = PLAN_CONFIG.free.invoicesPerMonth;

export default async function NewInvoicePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, invoice_count_this_month")
    .eq("id", user.id)
    .single();

  const atLimit =
    profile?.plan === "free" &&
    (profile?.invoice_count_this_month ?? 0) >= FREE_LIMIT;

  if (atLimit) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Free plan limit reached</h2>
        <p className="text-muted-foreground">
          You&apos;ve used all {FREE_LIMIT} invoices included in the free plan this
          month. Upgrade to create unlimited invoices.
        </p>
        <Button asChild>
          <Link href="/dashboard/billing">Upgrade plan</Link>
        </Button>
        <div className="pt-2">
          <Link
            href="/dashboard/invoices"
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            Back to invoices
          </Link>
        </div>
      </div>
    );
  }

  return <InvoiceForm />;
}

