import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/feature-access";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await isSuperAdmin(user.id, user.email!);
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage user subscriptions, feature access, and view audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/admin/users"
          className="block p-6 bg-white border rounded-lg hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscriptions, grant or revoke individual feature access.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/audit-logs"
          className="block p-6 bg-white border rounded-lg hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Full audit trail of all permission changes made by admins.
          </p>
        </Link>

        <div className="p-6 bg-white border rounded-lg opacity-50 cursor-not-allowed">
          <h2 className="font-semibold text-gray-900">Feature Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable features globally across all plans. (Coming soon)
          </p>
        </div>
      </div>
    </div>
  );
}
