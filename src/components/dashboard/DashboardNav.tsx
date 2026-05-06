"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Invoices", href: "/dashboard/invoices" },
  { label: "Quotations", href: "/dashboard/quotations" },
  { label: "Clients", href: "/dashboard/clients" },
  { label: "Products", href: "/dashboard/products" },
  { label: "Expenses", href: "/dashboard/expenses" },
  { label: "Recurring", href: "/dashboard/recurring" },
  { label: "Credit Notes", href: "/dashboard/credit-notes" },
  { label: "GST Reports", href: "/dashboard/gst-reports" },
  { label: "Aging", href: "/dashboard/reports/aging" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardNav({
  businessName,
  plan,
}: {
  businessName: string;
  plan: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg text-gray-900">GST Billing</span>
            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href))
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={plan === "free" ? "secondary" : "default"} className="capitalize">
              {plan}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-32">
              {businessName}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
