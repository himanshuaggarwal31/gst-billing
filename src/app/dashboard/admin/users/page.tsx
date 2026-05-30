"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type UserRow = {
  id: string;
  email: string;
  business_name: string;
  business_email: string | null;
  gstin: string | null;
  plan: string;
  is_super_admin: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    const res  = await fetch(`/api/admin/users?${params}`);
    const json = await res.json();
    if (json.data) {
      setUsers(json.data.users ?? []);
      setTotal(json.data.total ?? 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function getActiveSubscription(user: UserRow) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-muted-foreground">{total} total users</p>
        </div>
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="sm">← Admin Home</Button>
        </Link>
      </div>

      <Input
        placeholder="Search by business name, GSTIN, or login email…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.business_name || "(no business name)"}</p>
                      {u.gstin && <p className="text-xs text-muted-foreground font-mono">{u.gstin}</p>}
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.plan === "free" ? "secondary" : "default"} className="capitalize">
                        {u.plan}
                      </Badge>
                      {u.is_super_admin && (
                        <Badge variant="destructive" className="ml-1 text-xs">Admin</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">active</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">—</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/admin/users/${u.id}`}>
                        <Button variant="ghost" size="sm">Manage</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No users found.</p>
          )}
        </div>
      )}

      {total > 50 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
