"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GST_RATES } from "@/lib/gst";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  hsn_sac_code: string;
  is_service: boolean;
  default_rate: number;
  purchase_rate: number | null;
  default_gst_rate: number;
  cess_rate: number;
  unit: string;
};

const UNITS = ["Nos", "Pcs", "Kg", "Gm", "Ltr", "Mtr", "Sqft", "Box", "Set", "Hr", "Day", "Month"];

const EMPTY = {
  name: "",
  description: "",
  sku: "",
  hsn_sac_code: "",
  is_service: false,
  default_rate: 0 as number | string,
  purchase_rate: "" as number | string,
  default_gst_rate: 18,
  cess_rate: 0 as number | string,
  unit: "Nos",
};

type Props = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
};

export function ProductFormDialog({ open, product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name,
        description: product.description ?? "",
        sku: product.sku ?? "",
        hsn_sac_code: product.hsn_sac_code,
        is_service: product.is_service,
        default_rate: product.default_rate,
        purchase_rate: product.purchase_rate ?? "",
        default_gst_rate: product.default_gst_rate,
        cess_rate: product.cess_rate,
        unit: product.unit,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, product]);

  function set(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          sku: form.sku || null,
          default_rate: Number(form.default_rate),
          purchase_rate: form.purchase_rate !== "" && form.purchase_rate !== null ? Number(form.purchase_rate) : null,
          default_gst_rate: Number(form.default_gst_rate),
          cess_rate: Number(form.cess_rate) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Failed to save");
      } else {
        toast.success(isEdit ? "Product updated" : "Product added");
        onSaved(json.data);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product / Service" : "Add Product / Service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            {/* Row 1: Name */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-name">Name *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Web Development Service"
                required
              />
            </div>

            {/* Row 2: SKU | Type */}
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">Item Code / SKU</Label>
              <Input
                id="p-sku"
                value={form.sku ?? ""}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="ITEM-001"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-type">Type</Label>
              <Select
                value={form.is_service ? "service" : "product"}
                onValueChange={(v) => set("is_service", v === "service")}
              >
                <SelectTrigger id="p-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product (HSN)</SelectItem>
                  <SelectItem value="service">Service (SAC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: HSN/SAC | Unit */}
            <div className="space-y-1.5">
              <Label htmlFor="p-hsn">HSN / SAC Code *</Label>
              <Input
                id="p-hsn"
                value={form.hsn_sac_code}
                onChange={(e) => set("hsn_sac_code", e.target.value)}
                placeholder="998314"
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-unit">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger id="p-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Selling Rate | Purchase Rate (Cost) */}
            <div className="space-y-1.5">
              <Label htmlFor="p-rate">Selling Rate (₹) *</Label>
              <Input
                id="p-rate"
                type="number"
                min="0"
                step="0.01"
                value={form.default_rate}
                onChange={(e) => set("default_rate", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-purchase-rate">
                Purchase Rate / Cost (₹)
                <span className="ml-1 text-xs text-muted-foreground font-normal">optional</span>
              </Label>
              <Input
                id="p-purchase-rate"
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_rate ?? ""}
                onChange={(e) => set("purchase_rate", e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Row 5: GST Rate | Cess Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="p-gst">GST Rate *</Label>
              <Select
                value={String(form.default_gst_rate)}
                onValueChange={(v) => set("default_gst_rate", Number(v))}
              >
                <SelectTrigger id="p-gst">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-cess">
                Cess Rate (%)
                <span className="ml-1 text-xs text-muted-foreground font-normal">if applicable</span>
              </Label>
              <Input
                id="p-cess"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.cess_rate}
                onChange={(e) => set("cess_rate", e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Row 6: Description */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-desc">Description</Label>
              <Input
                id="p-desc"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional details"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
