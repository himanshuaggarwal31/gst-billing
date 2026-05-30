"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTIONS = [
  "grant_feature",
  "revoke_feature",
  "update_override",
  "change_plan",
  "change_subscription_status",
  "set_super_admin",
  "revoke_super_admin",
];

type LogEntry = {
  id: string;
  actor_email: string;
  target_email: string | null;
  feature_id: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  grant_feature:               "default",
  revoke_feature:              "destructive",
  update_override:             "secondary",
  change_plan:                 "default",
  change_subscription_status:  "outline",
  set_super_admin:             "destructive",
  revoke_super_admin:          "outline",
};

export default function AuditLogsPage() {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [action, setAction]     = useState("__all__");
  const [loading, setLoading]   = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (action !== "__all__") params.set("action", action);
    const res  = await fetch(`/api/admin/audit-logs?${params}`);
    const json = await res.json();
    if (json.data) {
      setLogs(json.data.logs ?? []);
      setTotal(json.data.total ?? 0);
    }
    setLoading(false);
  }, [page, action]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">{total} total entries</p>
        </div>
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="sm">← Admin Home</Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-xs">{log.actor_email}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.target_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_BADGE_VARIANT[log.action] ?? "outline"} className="text-xs">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.feature_id ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No audit log entries found.</p>
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
