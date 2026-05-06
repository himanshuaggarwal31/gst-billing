"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFormDialog, type Product } from "@/components/products/ProductFormDialog";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function fetchProducts() {
    setLoading(true);
    const res = await fetch("/api/products");
    const json = await res.json();
    if (json.data) setProducts(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, []);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }

  function handleSaved(saved: Product) {
    setProducts((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      return exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...prev];
    });
    setDialogOpen(false);
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This won't affect existing invoices.`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) {
      toast.error(json.error.message);
    } else {
      toast.success("Product deleted");
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products &amp; Services</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saved catalog — pick items when creating invoices to skip retyping.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Product</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No products or services yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your commonly billed items to fill invoices in one click.
          </p>
          <Button className="mt-4" onClick={openAdd}>
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>HSN / SAC</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Default Rate</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.sku && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku}</div>
                    )}
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_service ? "secondary" : "outline"}>
                      {p.is_service ? "Service" : "Product"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{p.hsn_sac_code}</TableCell>
                  <TableCell className="text-sm">{p.unit}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.default_rate)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <div>{p.default_gst_rate}%</div>
                    {p.cess_rate > 0 && (
                      <div className="text-xs text-muted-foreground">+{p.cess_rate}% cess</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        product={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
