"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { NAV_ITEMS, NAV_GROUP_ORDER } from "@/lib/features";

export default function DashboardNav({
  businessName,
  plan,
}: {
  businessName: string;
  plan: string;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createSupabaseBrowserClient();
  const { can, isSuperAdmin, isLoading } = useFeatureAccess();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isSuperAdmin;
    if (item.feature)   return !isLoading && can(item.feature);
    return true;
  });

  // Split into groups and standalones
  const groups = NAV_GROUP_ORDER.map((groupName) => ({
    label: groupName,
    items: visibleItems.filter((item) => item.group === groupName),
  })).filter((g) => g.items.length > 0);

  const standaloneItems = visibleItems.filter((item) => !item.group);

  function isLinkActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname.startsWith(href);
  }

  function isGroupActive(groupName: string) {
    return visibleItems
      .filter((item) => item.group === groupName)
      .some((item) => isLinkActive(item.href));
  }

  const linkCls = (active: boolean) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-gray-100 text-gray-900"
        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    }`;

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="font-bold text-base text-gray-900 mr-3">GST Billing</span>

            {/* Standalone: Dashboard */}
            {standaloneItems.slice(0, 1).map((item) => (
              <Link key={item.href} href={item.href} className={linkCls(isLinkActive(item.href))}>
                {item.label}
              </Link>
            ))}

            {/* Grouped dropdowns */}
            {groups.map((group) => (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`${linkCls(isGroupActive(group.label))} flex items-center gap-1`}
                  >
                    {group.label}
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`w-full cursor-pointer ${isLinkActive(item.href) ? "font-semibold" : ""}`}
                      >
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}

            {/* Remaining standalones: Import, Team, Settings, Admin */}
            {standaloneItems.slice(1).map((item) => (
              <Link key={item.href} href={item.href} className={linkCls(isLinkActive(item.href))}>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Badge variant="destructive" className="text-xs">Super Admin</Badge>
            )}
            <Badge variant={plan === "free" ? "secondary" : "default"} className="capitalize text-xs">
              {plan}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-28">
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
