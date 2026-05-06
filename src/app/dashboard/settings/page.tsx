"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  pdf_theme: "classic" | "minimal" | "modern" | null;
  pdf_accent_color: string | null;
  pdf_footer_text: string | null;
  pdf_footer_text_invoice: string | null;
  pdf_footer_text_quotation: string | null;
  pdf_footer_text_ewb: string | null;
  pdf_terms: string | null;
  pdf_show_amount_in_words: boolean | null;
  pdf_print_copies: boolean | null;
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
    pdf_theme: "classic" as "classic" | "minimal" | "modern",
    pdf_accent_color: "",
    pdf_footer_text: "",
    pdf_footer_text_invoice: "",
    pdf_footer_text_quotation: "",
    pdf_footer_text_ewb: "",
    pdf_terms: "",
    pdf_show_amount_in_words: false,
    pdf_print_copies: false,
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
            pdf_theme: (data.pdf_theme ?? "classic") as "classic" | "minimal" | "modern",
            pdf_accent_color: data.pdf_accent_color ?? "",
            pdf_footer_text: data.pdf_footer_text ?? "",
            pdf_footer_text_invoice: data.pdf_footer_text_invoice ?? "",
            pdf_footer_text_quotation: data.pdf_footer_text_quotation ?? "",
            pdf_footer_text_ewb: data.pdf_footer_text_ewb ?? "",
            pdf_terms: data.pdf_terms ?? "",
            pdf_show_amount_in_words: data.pdf_show_amount_in_words ?? false,
            pdf_print_copies: data.pdf_print_copies ?? false,
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

  function setToggle(field: string, value: boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveProfile() {
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
          pdf_theme: form.pdf_theme,
          pdf_accent_color: form.pdf_accent_color || null,
          pdf_footer_text: form.pdf_footer_text || null,
          pdf_footer_text_invoice: form.pdf_footer_text_invoice || null,
          pdf_footer_text_quotation: form.pdf_footer_text_quotation || null,
          pdf_footer_text_ewb: form.pdf_footer_text_ewb || null,
          pdf_terms: form.pdf_terms || null,
          pdf_show_amount_in_words: form.pdf_show_amount_in_words,
          pdf_print_copies: form.pdf_print_copies,
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await saveProfile();
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

      {/* PDF Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Preferences</CardTitle>
          <CardDescription>
            These settings apply to every invoice and quotation PDF. Save your business settings above to apply changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Default theme */}
          <div className="space-y-1.5">
            <Label>Default PDF Theme</Label>
            <Select value={form.pdf_theme} onValueChange={(v) => set("pdf_theme", v as "classic" | "minimal" | "modern")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic (Blue)</SelectItem>
                <SelectItem value="minimal">Minimal (Monochrome)</SelectItem>
                <SelectItem value="modern">Modern (Purple)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used as the default when creating new invoices or quotations. Can be overridden per document.</p>
          </div>

          {/* Accent colour swatches */}
          <div className="space-y-1.5">
            <Label>Brand Accent Colour</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { hex: "#1a56db", label: "Classic Blue" },
                { hex: "#1d4ed8", label: "Royal Blue" },
                { hex: "#0ea5e9", label: "Sky Blue" },
                { hex: "#06b6d4", label: "Cyan" },
                { hex: "#0f766e", label: "Teal" },
                { hex: "#10b981", label: "Emerald" },
                { hex: "#166534", label: "Forest Green" },
                { hex: "#7c3aed", label: "Violet" },
                { hex: "#4f46e5", label: "Indigo" },
                { hex: "#db2777", label: "Pink" },
                { hex: "#9f1239", label: "Burgundy" },
                { hex: "#dc2626", label: "Red" },
                { hex: "#ea580c", label: "Orange" },
                { hex: "#d97706", label: "Amber" },
                { hex: "#374151", label: "Slate" },
                { hex: "#111827", label: "Charcoal" },
              ].map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => set("pdf_accent_color", form.pdf_accent_color === hex ? "" : hex)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.pdf_accent_color === hex
                      ? "border-gray-900 scale-110 shadow-md"
                      : "border-transparent hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              {form.pdf_accent_color && (
                <button
                  type="button"
                  onClick={() => set("pdf_accent_color", "")}
                  className="text-xs text-muted-foreground hover:text-foreground underline self-center ml-1"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Overrides the theme's default colour for header, title, and totals. Leave unset to use the theme default.
            </p>
          </div>

          {/* Custom footer text — global + per document type */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pdf_footer_text">PDF Footer Text (Global Default)</Label>
              <Input
                id="pdf_footer_text"
                value={form.pdf_footer_text}
                onChange={(e) => set("pdf_footer_text", e.target.value)}
                placeholder="Bank: HDFC | A/C: 1234567890 | IFSC: HDFC0001234"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">Appears at the bottom of every PDF unless overridden below.</p>
            </div>
            <div className="pl-3 border-l-2 border-muted space-y-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="pdf_footer_text_invoice" className="text-muted-foreground font-normal">Invoice footer override</Label>
                <Input
                  id="pdf_footer_text_invoice"
                  value={form.pdf_footer_text_invoice}
                  onChange={(e) => set("pdf_footer_text_invoice", e.target.value)}
                  placeholder="Leave blank to use the global default"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdf_footer_text_quotation" className="text-muted-foreground font-normal">Quotation footer override</Label>
                <Input
                  id="pdf_footer_text_quotation"
                  value={form.pdf_footer_text_quotation}
                  onChange={(e) => set("pdf_footer_text_quotation", e.target.value)}
                  placeholder="Leave blank to use the global default"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdf_footer_text_ewb" className="text-muted-foreground font-normal">E-Way Bill footer override</Label>
                <Input
                  id="pdf_footer_text_ewb"
                  value={form.pdf_footer_text_ewb}
                  onChange={(e) => set("pdf_footer_text_ewb", e.target.value)}
                  placeholder="Leave blank to use the global default"
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-1.5">
            <Label htmlFor="pdf_terms">Terms &amp; Conditions</Label>
            <Textarea
              id="pdf_terms"
              value={form.pdf_terms}
              onChange={(e) => set("pdf_terms", e.target.value)}
              rows={3}
              placeholder={"1. Payment due within 30 days.\n2. Goods once sold will not be returned.\n3. Subject to local jurisdiction."}
            />
            <p className="text-xs text-muted-foreground">Printed below Notes on every invoice PDF. Leave blank to omit.</p>
          </div>

          {/* Amount in words */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.pdf_show_amount_in_words}
              onClick={() => setToggle("pdf_show_amount_in_words", !form.pdf_show_amount_in_words)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5 ${
                form.pdf_show_amount_in_words ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.pdf_show_amount_in_words ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium leading-none">Amount in Words</p>
              <p className="text-xs text-muted-foreground mt-0.5">Print total as &ldquo;Rupees One Lakh Twenty Thousand Only&rdquo; below the grand total.</p>
            </div>
          </div>

          {/* Print copies */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.pdf_print_copies}
              onClick={() => setToggle("pdf_print_copies", !form.pdf_print_copies)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5 ${
                form.pdf_print_copies ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.pdf_print_copies ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium leading-none">Two-Copy PDF (Original + Duplicate)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each downloaded invoice PDF will contain two pages — <strong>Original for Recipient</strong> and <strong>Duplicate for Supplier</strong> — in a single file, ready to print and split.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <Button type="button" disabled={saving} onClick={saveProfile}>
              {saving ? "Saving…" : "Save PDF Preferences"}
            </Button>
          </div>
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
