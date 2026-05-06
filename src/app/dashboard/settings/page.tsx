"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATE_CODES, stateLabel } from "@/lib/gst";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG } from "@/lib/plan-config";

type Profile = {
  business_name: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  pincode: string | null;
  email: string;
  phone: string | null;
  pan: string | null;
  logo_url: string | null;
  plan: string;
  invoice_count_this_month: number;
  pdf_status_style: "stamp" | "badge" | "none" | null;
  business_email: string | null;
  business_phone: string | null;
};

type TeamMember = {
  id: string;
  member_email: string;
  role: "viewer" | "editor";
  invited_at: string;
  accepted_at: string | null;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [inviting, setInviting] = useState(false);

  const [form, setForm] = useState({
    business_name: "",
    gstin: "",
    address: "",
    city: "",
    state_code: "",
    pincode: "",
    phone: "",
    pan: "",
    pdf_status_style: "stamp" as "stamp" | "badge" | "none",
    business_email: "",
    business_phone: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setForm({
            business_name: data.business_name ?? "",
            gstin: data.gstin ?? "",
            address: data.address ?? "",
            city: data.city ?? "",
            state_code: data.state_code ?? "",
            pincode: data.pincode ?? "",
            phone: data.phone ?? "",
            pan: data.pan ?? "",
            pdf_status_style: (data.pdf_status_style ?? "stamp") as "stamp" | "badge" | "none",
            business_email: data.business_email ?? "",
            business_phone: data.business_phone ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
    fetch("/api/team")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setTeam(data); });
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const json = await res.json();
    if (json.success) {
      setTeam((prev) => [json.data, ...prev]);
      setInviteEmail("");
      toast.success(`Invited ${inviteEmail}`);
    } else {
      toast.error(json.error?.message ?? "Failed to invite");
    }
    setInviting(false);
  }

  async function handleRevoke(id: string, email: string) {
    if (!confirm(`Remove ${email} from your account?`)) return;
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setTeam((prev) => prev.filter((m) => m.id !== id));
      toast.success("Access revoked");
    } else {
      toast.error(json.error?.message ?? "Failed to revoke");
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/profile/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Upload failed");
      } else {
        setProfile((p) => p ? { ...p, logo_url: json.data.logo_url } : p);
        toast.success("Logo uploaded");
      }
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleLogoRemove() {
    setLogoUploading(true);
    try {
      const res = await fetch("/api/profile/logo", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to remove logo");
      } else {
        setProfile((p) => p ? { ...p, logo_url: null } : p);
        toast.success("Logo removed");
      }
    } finally {
      setLogoUploading(false);
    }
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gstin: form.gstin || null,
          address: form.address || null,
          city: form.city || null,
          state_code: form.state_code || null,
          pincode: form.pincode || null,
          phone: form.phone || null,
          pan: form.pan || null,
          pdf_status_style: form.pdf_status_style,
          business_email: form.business_email || null,
          business_phone: form.business_phone || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to save");
      } else {
        setProfile(json.data);
        toast.success("Settings saved");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your business details appear on every invoice PDF.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            These details appear in the &quot;Bill From&quot; section of all invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  value={form.business_name}
                  onChange={(e) => set("business_name", e.target.value)}
                  placeholder="Acme Trading Co."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  placeholder="27AABCU9603R1ZX"
                  maxLength={15}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pan">PAN</Label>
                <Input
                  id="pan"
                  value={form.pan}
                  onChange={(e) => set("pan", e.target.value.toUpperCase())}
                  placeholder="AABCU9603R"
                  maxLength={10}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Plot 12, MIDC Industrial Area"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Mumbai"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state_code">State</Label>
                <Select value={form.state_code} onValueChange={(v) => set("state_code", v)}>
                  <SelectTrigger id="state_code">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDIAN_STATE_CODES).map(([code]) => (
                      <SelectItem key={code} value={code}>{stateLabel(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                  placeholder="400093"
                  maxLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business_email">Business Email</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={form.business_email}
                  onChange={(e) => set("business_email", e.target.value)}
                  placeholder="billing@yourcompany.com"
                />
                <p className="text-xs text-muted-foreground">Shown on invoices. Leave blank to use your account email.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business_phone">Business Phone</Label>
                <Input
                  id="business_phone"
                  value={form.business_phone}
                  onChange={(e) => set("business_phone", e.target.value)}
                  placeholder="+91 98765 43210"
                />
                <p className="text-xs text-muted-foreground">Shown on invoices. Separate from your personal contact.</p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Login email: <strong>{profile?.email}</strong>
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Logo</CardTitle>
          <CardDescription>
            Your logo appears at the top of every invoice PDF. Recommended size: 200×80 px. Max 2 MB (PNG, JPG, WebP, SVG).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="w-40 h-16 border rounded flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {profile?.logo_url ? (
              <Image src={profile.logo_url} alt="Business logo" width={160} height={64} className="object-contain w-full h-full" unoptimized />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
            >
              {logoUploading ? "Uploading…" : profile?.logo_url ? "Change Logo" : "Upload Logo"}
            </Button>
            {profile?.logo_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleLogoRemove}
                disabled={logoUploading}
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Your current subscription plan.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium capitalize">{profile?.plan ?? "free"}</p>
            {profile?.plan === "free" && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {profile.invoice_count_this_month}/{PLAN_CONFIG.free.invoicesPerMonth} invoices used this month
              </p>
            )}
          </div>
          {profile?.plan === "free" && (
            <Button variant="outline" disabled>
              Upgrade (coming soon)
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Access</CardTitle>
          <CardDescription>
            Invite your accountant or team members. They will be able to view your invoices and reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              placeholder="accountant@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "viewer" | "editor")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Inviting…" : "Invite"}
            </Button>
          </form>
          {team.length > 0 && (
            <div className="rounded-md border divide-y">
              {team.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{m.member_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(m.invited_at).toLocaleDateString("en-IN")}
                      {m.accepted_at ? " · Accepted" : " · Pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(m.id, m.member_email)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {team.length === 0 && (
            <p className="text-sm text-muted-foreground">No team members invited yet.</p>
          )}
        </CardContent>
      </Card>

      {/* PDF Status Display */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Status Display</CardTitle>
          <CardDescription>
            Choose how the payment status appears on downloaded and emailed invoice PDFs.
            Save your business settings above to apply this change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  value: "stamp",
                  label: "Diagonal Stamp",
                  desc: "Large watermark across the page — PAID in green, OVERDUE in red.",
                  preview: (
                    <div className="relative w-full h-16 border rounded bg-gray-50 overflow-hidden flex items-center justify-center">
                      <span className="text-[10px] text-gray-300 leading-none">Invoice&hellip;</span>
                      <span
                        className="absolute text-green-700 font-bold text-xs opacity-30 rotate-[-35deg] tracking-widest"
                        style={{ fontSize: 13 }}
                      >
                        PAID
                      </span>
                    </div>
                  ),
                },
                {
                  value: "badge",
                  label: "Header Badge",
                  desc: "Small coloured pill next to invoice details — visible but non-intrusive.",
                  preview: (
                    <div className="w-full h-16 border rounded bg-gray-50 flex items-start justify-end p-2">
                      <span className="bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        PAID
                      </span>
                    </div>
                  ),
                },
                {
                  value: "none",
                  label: "None",
                  desc: "No status indicator on the PDF — a clean look with no annotation.",
                  preview: (
                    <div className="w-full h-16 border rounded bg-gray-50 flex items-center justify-center">
                      <span className="text-[10px] text-gray-300">No indicator</span>
                    </div>
                  ),
                },
              ] as const
            ).map(({ value, label, desc, preview }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("pdf_status_style", value)}
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  form.pdf_status_style === value
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {preview}
                <p className={`mt-2 text-sm font-semibold ${form.pdf_status_style === value ? "text-blue-700" : "text-gray-800"}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
