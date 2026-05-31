import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { PLAN_CONFIG } from "@/lib/plan-config";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [invoicesResult, profileResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount, payment_status, total_gst")
      .eq("user_id", user!.id),
    supabase
      .from("profiles")
      .select("business_name, plan, invoice_count_this_month")
      .eq("id", user!.id)
      .single(),
  ]);

  const invoices = invoicesResult.data ?? [];
  const profile = profileResult.data;

  const totalBilled  = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalGst     = invoices.reduce((s, i) => s + Number(i.total_gst), 0);
  const totalPending = invoices
    .filter((i) => i.payment_status !== "paid")
    .reduce((s, i) => s + Number(i.total_amount), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const FREE_LIMIT = PLAN_CONFIG.free.invoicesPerMonth;
  const isNearLimit =
    profile?.plan === "free" && (profile?.invoice_count_this_month ?? 0) >= FREE_LIMIT - 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>
      <DashboardTabs
        businessName={profile?.business_name || "Welcome"}
        plan={profile?.plan || "free"}
        invoiceCountThisMonth={profile?.invoice_count_this_month ?? 0}
        totalBilled={fmt(totalBilled)}
        totalGst={fmt(totalGst)}
        totalPending={fmt(totalPending)}
        isNearLimit={isNearLimit}
        freeLimit={FREE_LIMIT}
      />
    </div>
  );
}
