import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalGst = invoices.reduce((s, i) => s + Number(i.total_gst), 0);
  const totalPending = invoices
    .filter((i) => i.payment_status !== "paid")
    .reduce((s, i) => s + Number(i.total_amount), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const FREE_LIMIT = 5;
  const isNearLimit =
    profile?.plan === "free" && (profile?.invoice_count_this_month ?? 0) >= FREE_LIMIT - 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profile?.business_name || "Welcome"}
          </p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>+ New Invoice</Button>
        </Link>
      </div>

      {isNearLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            You&apos;ve used {profile?.invoice_count_this_month}/{FREE_LIMIT} free invoices this month.
          </p>
          <Link href="/dashboard/billing">
            <Button size="sm" variant="outline">Upgrade Plan</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalBilled)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">GST Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalGst)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/invoices">
          <Button variant="outline">View All Invoices</Button>
        </Link>
        <Link href="/dashboard/clients">
          <Button variant="outline">Manage Clients</Button>
        </Link>
      </div>
    </div>
  );
}
