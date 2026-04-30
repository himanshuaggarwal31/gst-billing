"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDIAN_STATE_CODES } from "@/lib/gst";

export type Client = {
  id: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  state_code: string;
  pincode: string | null;
};

type Props = {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
};

const EMPTY = {
  name: "",
  gstin: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state_code: "",
  pincode: "",
};

export default function ClientFormDialog({ open, client, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(
        client
          ? {
              name: client.name,
              gstin: client.gstin ?? "",
              email: client.email ?? "",
              phone: client.phone ?? "",
              address: client.address,
              city: client.city ?? "",
              state_code: client.state_code,
              pincode: client.pincode ?? "",
            }
          : EMPTY
      );
    }
  }, [open, client]);
  const [loading, setLoading] = useState(false);

  const isEdit = !!client;

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit ? `/api/clients/${client!.id}` : "/api/clients";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error.message);
      } else {
        toast.success(isEdit ? "Client updated" : "Client added");
        onSaved(json.data);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Business / Client Name *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>
            <div className="space-y-1">
              <Label>PAN / Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>State *</Label>
              <Select
                value={form.state_code}
                onValueChange={(v) => set("state_code", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INDIAN_STATE_CODES).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{code} — {name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address *</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} maxLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
