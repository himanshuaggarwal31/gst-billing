"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEATURE_IDS } from "@/lib/features";
import type { FeatureId } from "@/lib/features";

const PLANS = ["free", "starter", "pro", "ca", "enterprise"];

type Override = {
  feature_id: FeatureId;
  is_enabled: boolean;
  reason: string | null;
  expires_at: string | null;
  features: { name: string; module: string } | null;
};

type UserDetail = {
  profile: { email: string; business_name: string; plan: string; is_super_admin: boolean };
  subscriptions: { id: string; plan_id: string; status: string; expires_at: string | null; started_at: string }[];
  overrides: Override[];
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [detail, setDetail]           = useState<UserDetail | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // Plan-change form state
  const [newPlan, setNewPlan]         = useState("");
  const [planStatus, setPlanStatus]   = useState<"active" | "trial">("active");
  const [planExpiry, setPlanExpiry]   = useState("");
  const [trialEnds, setTrialEnds]     = useState("");
  const [planNotes, setPlanNotes]     = useState("");

  // Override form state
  const [ofFeature, setOfFeature]     = useState<FeatureId>("invoices");
  const [ofEnabled, setOfEnabled]     = useState(true);
  const [ofReason, setOfReason]       = useState("");
  const [ofExpiry, setOfExpiry]       = useState("");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/users/${id}`);
    const json = await res.json();
    if (json.data) setDetail(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function changePlan() {
    setSaving(true);
    await fetch(`/api/admin/users/${id}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId:      newPlan,
        status:      planStatus,
        expiresAt:   planExpiry  ? new Date(planExpiry).toISOString()  : null,
        trialEndsAt: trialEnds   ? new Date(trialEnds).toISOString()   : null,
        notes:       planNotes   || null,
      }),
    });
    setSaving(false);
    fetchDetail();
  }

  async function upsertOverride() {
    setSaving(true);
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        featureId: ofFeature,
        isEnabled: ofEnabled,
        reason:    ofReason  || null,
        expiresAt: ofExpiry  ? new Date(ofExpiry).toISOString()  : null,
      }),
    });
    setSaving(false);
    fetchDetail();
  }

  async function removeOverride(featureId: FeatureId) {
    await fetch(`/api/admin/users/${id}?featureId=${featureId}`, { method: "DELETE" });
    fetchDetail();
  }

  if (loading || !detail) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const { profile, subscriptions, overrides } = detail;
  const activeSub = subscriptions.find((s) => s.status === "active" || s.status === "trial");

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/admin/users" className="hover:underline">Users</Link>
        <span>/</span>
        <span className="text-gray-900">{profile.email}</span>
      </div>

      {/* Profile summary */}
      <div className="bg-white border rounded-lg p-5 space-y-1">
        <p className="font-semibold text-gray-900">{profile.business_name || "(no business name)"}</p>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <div className="flex gap-2 pt-1">
          <Badge variant={profile.plan === "free" ? "secondary" : "default"} className="capitalize">
            {activeSub?.plan_id ?? profile.plan}
          </Badge>
          {profile.is_super_admin && <Badge variant="destructive">Super Admin</Badge>}
          {activeSub && <Badge variant="outline">{activeSub.status}</Badge>}
        </div>
      </div>

      {/* Change subscription */}
      <section className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold">Change Subscription</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Plan</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={planStatus} onValueChange={(v) => setPlanStatus(v as "active" | "trial")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Expires at (optional)</Label>
            <Input type="date" value={planExpiry} onChange={(e) => setPlanExpiry(e.target.value)} />
          </div>
          <div>
            <Label>Trial ends at (optional)</Label>
            <Input type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes / reason</Label>
          <Input value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="e.g. Complimentary upgrade" />
        </div>
        <Button disabled={!newPlan || saving} onClick={changePlan}>
          {saving ? "Saving…" : "Apply subscription change"}
        </Button>
      </section>

      {/* Feature overrides */}
      <section className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold">Feature Override</h2>
        <p className="text-sm text-muted-foreground">
          Overrides take precedence over the subscription plan. Use to grant early access, restrict a feature, or set custom limits.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Feature</Label>
            <Select value={ofFeature} onValueChange={(v) => setOfFeature(v as FeatureId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEATURE_IDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Action</Label>
            <Select value={String(ofEnabled)} onValueChange={(v) => setOfEnabled(v === "true")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Grant access</SelectItem>
                <SelectItem value="false">Revoke access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Expires at (optional)</Label>
            <Input type="date" value={ofExpiry} onChange={(e) => setOfExpiry(e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={ofReason} onChange={(e) => setOfReason(e.target.value)} placeholder="e.g. Beta tester" />
          </div>
        </div>
        <Button disabled={saving} onClick={upsertOverride}>
          {saving ? "Saving…" : "Save override"}
        </Button>
      </section>

      {/* Active overrides table */}
      {overrides.length > 0 && (
        <section className="bg-white border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Active Overrides</h2>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 font-medium text-gray-600">Feature</th>
                <th className="text-left py-2 font-medium text-gray-600">Action</th>
                <th className="text-left py-2 font-medium text-gray-600">Expires</th>
                <th className="text-left py-2 font-medium text-gray-600">Reason</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {overrides.map((o) => (
                <tr key={o.feature_id}>
                  <td className="py-2">{o.features?.name ?? o.feature_id}</td>
                  <td className="py-2">
                    <Badge variant={o.is_enabled ? "default" : "destructive"}>
                      {o.is_enabled ? "Granted" : "Revoked"}
                    </Badge>
                  </td>
                  <td className="py-2 text-muted-foreground text-xs">
                    {o.expires_at ? new Date(o.expires_at).toLocaleDateString("en-IN") : "Permanent"}
                  </td>
                  <td className="py-2 text-muted-foreground text-xs">{o.reason ?? "—"}</td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => removeOverride(o.feature_id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Subscription history */}
      {subscriptions.length > 0 && (
        <section className="bg-white border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Subscription History</h2>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 font-medium text-gray-600">Plan</th>
                <th className="text-left py-2 font-medium text-gray-600">Status</th>
                <th className="text-left py-2 font-medium text-gray-600">Started</th>
                <th className="text-left py-2 font-medium text-gray-600">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 capitalize">{s.plan_id}</td>
                  <td className="py-2"><Badge variant="outline">{s.status}</Badge></td>
                  <td className="py-2 text-muted-foreground text-xs">
                    {new Date(s.started_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-2 text-muted-foreground text-xs">
                    {s.expires_at ? new Date(s.expires_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
