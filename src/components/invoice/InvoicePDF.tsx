import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { stateLabel } from "@/lib/gst";

// ── Theme definitions ─────────────────────────────────────────────────────────
export type InvoiceTheme = "classic" | "minimal" | "modern";

const THEMES: Record<InvoiceTheme, {
  accent: string;
  tableHeaderBg: string;
  tableHeaderColor: string;
  titleColor: string;
  partyBg: string;
  partyBorder: string;
  grandTotalColor: string;
  dividerColor: string;
}> = {
  classic: {
    accent: "#1a56db",
    tableHeaderBg: "#1a56db",
    tableHeaderColor: "#fff",
    titleColor: "#1a56db",
    partyBg: "#f9fafb",
    partyBorder: "#e5e7eb",
    grandTotalColor: "#1a56db",
    dividerColor: "#1a56db",
  },
  minimal: {
    accent: "#111827",
    tableHeaderBg: "#f3f4f6",
    tableHeaderColor: "#374151",
    titleColor: "#111827",
    partyBg: "#ffffff",
    partyBorder: "#d1d5db",
    grandTotalColor: "#111827",
    dividerColor: "#9ca3af",
  },
  modern: {
    accent: "#7c3aed",
    tableHeaderBg: "#7c3aed",
    tableHeaderColor: "#fff",
    titleColor: "#7c3aed",
    partyBg: "#faf5ff",
    partyBorder: "#e9d5ff",
    grandTotalColor: "#7c3aed",
    dividerColor: "#7c3aed",
  },
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 40,
    color: "#111",
  },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  companyLeft: { flexDirection: "row", alignItems: "flex-start", maxWidth: "55%" },
  logoImg: { width: 56, height: 56, objectFit: "contain", marginRight: 10 },
  companyBlock: { justifyContent: "flex-start" },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  companyDetail: { fontSize: 8, color: "#555", marginBottom: 2 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { fontSize: 8, color: "#888", width: 80, textAlign: "right" },
  metaValue: { fontSize: 8, fontFamily: "Helvetica-Bold", marginLeft: 6 },
  // Parties
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  partyBox: {
    width: "47%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  partyLabel: { fontSize: 7, color: "#888", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  partyDetail: { fontSize: 8, color: "#444", marginBottom: 2 },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a56db",
    color: "#fff",
    padding: "6 8",
    borderRadius: 2,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    padding: "5 8",
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  // Column widths — must total exactly 100% to avoid react-pdf flex drift
  // 4+22+10+6+14+6+14+8+16 = 100
  colSno:     { width: "4%" },
  colDesc:    { width: "22%" },
  colHsn:     { width: "10%" },
  colQty:     { width: "6%",  textAlign: "right" },
  colRate:    { width: "14%", textAlign: "right", paddingLeft: 4 },
  colDisc:    { width: "6%",  textAlign: "right" },
  colTaxable: { width: "14%", textAlign: "right", paddingLeft: 4 },
  colGst:     { width: "8%",  textAlign: "right" },
  colTotal:   { width: "16%", textAlign: "right", paddingLeft: 4 },
  thText: { color: "#fff", fontSize: 7, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8, color: "#222" },
  // Totals
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 8, color: "#555" },
  totalValue: { fontSize: 8, color: "#222" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#1a56db",
    paddingTop: 5,
    marginTop: 3,
  },
  grandTotalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a56db" },
  // GST breakdown
  gstBreakdown: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
  },
  gstBreakdownTitle: { fontSize: 7, color: "#888", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  gstRow: { flexDirection: "row" },
  gstColHead: { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#555", paddingBottom: 3 },
  gstColCell: { flex: 1, fontSize: 8, color: "#222" },
  // Status stamp (diagonal watermark)
  stampOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    transform: 'rotate(-35deg)',
  },
  stampBorderBox: {
    borderWidth: 5,
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 8,
    opacity: 0.14,
  },
  stampText: { fontSize: 60, fontFamily: 'Helvetica-Bold', letterSpacing: 8 },
  // Status badge (in header meta)
  badgePillWrap: { marginTop: 6, alignSelf: 'flex-end' },
  badgePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  // Notes / footer
  notesSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 },
  notesLabel: { fontSize: 7, color: "#888", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  notesText: { fontSize: 8, color: "#444" },
  // e-Invoice section
  eInvoiceSection: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  eInvoiceLeft: { flex: 1, paddingRight: 8 },
  eInvoiceSectionTitle: { fontSize: 7, color: "#888", textTransform: "uppercase" as const, marginBottom: 5, letterSpacing: 0.5 },
  eInvoiceRow: { flexDirection: "row" as const, marginBottom: 3 },
  eInvoiceLabel: { fontSize: 6.5, color: "#888", width: 48 },
  eInvoiceValue: { fontSize: 6.5, fontFamily: "Helvetica-Bold", flex: 1 },
  eInvoiceQr: { width: 72, height: 72 },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#aaa" },
  // Amount in words
  amountInWordsRow: { marginTop: 4 },
  amountInWordsText: { fontSize: 7.5, color: "#555", fontStyle: "italic" },
  // Terms & Conditions
  termsSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 },
  // Copy label (Original for Recipient / Duplicate for Supplier)
  copyLabelText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#888", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 4 },
});

export type InvoicePDFData = {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  payment_status: string;
  pdf_status_style?: "stamp" | "badge" | "none" | null;
  notes: string | null;
  theme?: InvoiceTheme | null;
  accent_color?: string | null;
  footer_text?: string | null;
  terms?: string | null;
  show_amount_in_words?: boolean | null;
  seller_state_code: string;
  buyer_state_code: string;
  is_inter_state: boolean;
  taxable_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  total_amount: number;
  eway_bill_number?: string | null;
  eway_bill_valid_until?: string | null;
  e_invoice?: {
    irn: string;
    ack_no: string | null;
    ack_date: string | null;
    qr_data_url: string | null;
  } | null;
  seller: {
    business_name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string | null;
    pincode: string | null;
    email: string;
    phone: string | null;
    pan: string | null;
    logo_url?: string | null;
  };
  client: {
    name: string;
    gstin: string | null;
    address: string;
    city: string | null;
    state_code: string;
    pincode: string | null;
    email: string | null;
    phone: string | null;
  };
  line_items: Array<{
    sort_order: number;
    description: string;
    hsn_sac_code: string;
    quantity: number;
    rate: number;
    discount_percent: number;
    gst_rate: number;
    taxable_amount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total_gst: number;
    line_total: number;
  }>;
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  paid:    { color: '#166534', bg: '#dcfce7', label: 'PAID' },
  overdue: { color: '#991b1b', bg: '#fee2e2', label: 'OVERDUE' },
  pending: { color: '#92400e', bg: '#fef3c7', label: 'PENDING' },
};

function fmtCurrency(n: number) {
  // ₹ (U+20B9) is not in Helvetica — use "Rs." for reliable PDF rendering
  return `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Convert a number to Indian rupees in words (e.g. 123456.78 → "One Lakh Twenty-Three Thousand…")
function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100);
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function toWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
    if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
    return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "");
  }

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  let result = rupees > 0 ? toWords(rupees) + " Rupees" : "";
  if (paise > 0) result += (result ? " and " : "") + toWords(paise) + " Paise";
  return result + " Only";
}

// Build effective theme, applying custom accent colour on top of the base theme
function buildTheme(theme: InvoiceTheme, accentColor?: string | null) {
  const base = { ...THEMES[theme] };
  if (accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    base.accent = accentColor;
    base.titleColor = accentColor;
    base.grandTotalColor = accentColor;
    base.dividerColor = accentColor;
    // Minimal theme has a light gray table header — don't override that
    if (theme !== "minimal") {
      base.tableHeaderBg = accentColor;
      // tableHeaderColor remains white (already set in classic/modern)
    }
  }
  return base;
}

// Inner component renders a single invoice page (used twice for two-copy mode)
function InvoicePage({
  data,
  documentTitle,
  documentLabel,
  copyLabel,
}: {
  data: InvoicePDFData;
  documentTitle: string;
  documentLabel: string;
  copyLabel?: string | null;
}) {
  const lines = [...data.line_items].sort((a, b) => a.sort_order - b.sort_order);
  const themeKey = (data.theme as InvoiceTheme) ?? "classic";
  const t = buildTheme(themeKey, data.accent_color);
  const effectiveStatusStyle = data.pdf_status_style ?? "stamp";
  const statusInfo = STATUS_STYLE[data.payment_status] ?? STATUS_STYLE.pending;
  const effectiveFooter = data.footer_text?.trim() || "This is a computer-generated document";

  return (
    <Page size="A4" style={styles.page}>
      {/* Header: [logo + company text] ............. [invoice meta] */}
      <View style={styles.headerRow}>
        <View style={styles.companyLeft}>
          {data.seller.logo_url && (
            <Image style={styles.logoImg} src={data.seller.logo_url} />
          )}
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.seller.business_name}</Text>
          {data.seller.gstin && (
            <Text style={styles.companyDetail}>GSTIN: {data.seller.gstin}</Text>
          )}
          {data.seller.address && (
            <Text style={styles.companyDetail}>{data.seller.address}</Text>
          )}
          {(data.seller.city || data.seller.pincode) && (
            <Text style={styles.companyDetail}>
              {[data.seller.city, data.seller.pincode].filter(Boolean).join(" – ")}
            </Text>
          )}
          {data.seller.email && (
            <Text style={styles.companyDetail}>{data.seller.email}</Text>
          )}
          {data.seller.phone && (
            <Text style={styles.companyDetail}>{data.seller.phone}</Text>
          )}
          </View>
        </View>
        <View style={styles.invoiceMeta}>
          <Text style={[styles.invoiceTitle, { color: t.titleColor }]}>{documentTitle}</Text>
          {copyLabel && (
            <Text style={styles.copyLabelText}>{copyLabel}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{documentLabel}</Text>
            <Text style={styles.metaValue}>{data.invoice_number}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.invoice_date)}</Text>
          </View>
          {data.due_date && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{fmtDate(data.due_date)}</Text>
            </View>
          )}
          {data.eway_bill_number && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>e-Way Bill No.</Text>
              <Text style={styles.metaValue}>{data.eway_bill_number}</Text>
            </View>
          )}
          {data.eway_bill_valid_until && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>EWB Valid Until</Text>
              <Text style={styles.metaValue}>{fmtDate(data.eway_bill_valid_until)}</Text>
            </View>
          )}
          {effectiveStatusStyle === "badge" && (
            <View style={styles.badgePillWrap}>
              <View style={[styles.badgePill, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Bill To / Seller */}
      <View style={styles.partiesRow}>
        <View style={[styles.partyBox, { backgroundColor: t.partyBg, borderColor: t.partyBorder }]}>
          <Text style={styles.partyName}>{data.seller.business_name}</Text>
          {data.seller.gstin && <Text style={styles.partyDetail}>GSTIN: {data.seller.gstin}</Text>}
          {data.seller.pan && <Text style={styles.partyDetail}>PAN: {data.seller.pan}</Text>}
          <Text style={styles.partyDetail}>State: {data.seller_state_code?.trim() ? stateLabel(data.seller_state_code) : "—"}</Text>
        </View>
        <View style={[styles.partyBox, { backgroundColor: t.partyBg, borderColor: t.partyBorder }]}>
          <Text style={styles.partyName}>{data.client.name}</Text>
          {data.client.gstin && <Text style={styles.partyDetail}>GSTIN: {data.client.gstin}</Text>}
          {data.client.address && <Text style={styles.partyDetail}>{data.client.address}</Text>}
          {(data.client.city || data.client.pincode) && (
            <Text style={styles.partyDetail}>
              {[data.client.city, data.client.pincode].filter(Boolean).join(" – ")}
            </Text>
          )}
          {data.client.email && <Text style={styles.partyDetail}>{data.client.email}</Text>}
          <Text style={styles.partyDetail}>State: {data.buyer_state_code?.trim() ? stateLabel(data.buyer_state_code) : "—"}</Text>
        </View>
      </View>

      {/* Line Items Table */}
      <View style={[styles.tableHeader, { backgroundColor: t.tableHeaderBg }]}>
        <Text style={[styles.thText, styles.colSno, { color: t.tableHeaderColor }]}>#</Text>
        <Text style={[styles.thText, styles.colDesc, { color: t.tableHeaderColor }]}>Description</Text>
        <Text style={[styles.thText, styles.colHsn, { color: t.tableHeaderColor }]}>HSN/SAC</Text>
        <Text style={[styles.thText, styles.colQty, { color: t.tableHeaderColor }]}>Qty</Text>
        <Text style={[styles.thText, styles.colRate, { color: t.tableHeaderColor }]}>Rate</Text>
        <Text style={[styles.thText, styles.colDisc, { color: t.tableHeaderColor }]}>Disc%</Text>
        <Text style={[styles.thText, styles.colTaxable, { color: t.tableHeaderColor }]}>Taxable</Text>
        <Text style={[styles.thText, styles.colGst, { color: t.tableHeaderColor }]}>GST%</Text>
        <Text style={[styles.thText, styles.colTotal, { color: t.tableHeaderColor }]}>Total</Text>
      </View>
      {lines.map((item, idx) => (
        <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={[styles.tdText, styles.colSno]}>{idx + 1}</Text>
          <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
          <Text style={[styles.tdText, styles.colHsn]}>{item.hsn_sac_code}</Text>
          <Text style={[styles.tdText, styles.colQty]}>{item.quantity}</Text>
          <Text style={[styles.tdText, styles.colRate]}>{fmtCurrency(item.rate)}</Text>
          <Text style={[styles.tdText, styles.colDisc]}>{item.discount_percent}%</Text>
          <Text style={[styles.tdText, styles.colTaxable]}>{fmtCurrency(item.taxable_amount)}</Text>
          <Text style={[styles.tdText, styles.colGst]}>{item.gst_rate}%</Text>
          <Text style={[styles.tdText, styles.colTotal]}>{fmtCurrency(item.line_total)}</Text>
        </View>
      ))}

      {/* GST Breakdown */}
      <View style={styles.gstBreakdown}>
        <Text style={styles.gstBreakdownTitle}>GST Summary</Text>
        <View style={styles.gstRow}>
          <Text style={styles.gstColHead}>Tax Type</Text>
          <Text style={styles.gstColHead}>Rate</Text>
          <Text style={styles.gstColHead}>Taxable</Text>
          <Text style={styles.gstColHead}>Tax Amt</Text>
        </View>
        {data.is_inter_state ? (
          <View style={styles.gstRow}>
            <Text style={styles.gstColCell}>IGST</Text>
            <Text style={styles.gstColCell}>—</Text>
            <Text style={styles.gstColCell}>{fmtCurrency(data.taxable_amount)}</Text>
            <Text style={styles.gstColCell}>{fmtCurrency(data.total_igst)}</Text>
          </View>
        ) : (
          <>
            <View style={styles.gstRow}>
              <Text style={styles.gstColCell}>CGST</Text>
              <Text style={styles.gstColCell}>—</Text>
              <Text style={styles.gstColCell}>{fmtCurrency(data.taxable_amount)}</Text>
              <Text style={styles.gstColCell}>{fmtCurrency(data.total_cgst)}</Text>
            </View>
            <View style={styles.gstRow}>
              <Text style={styles.gstColCell}>SGST</Text>
              <Text style={styles.gstColCell}>—</Text>
              <Text style={styles.gstColCell}>{fmtCurrency(data.taxable_amount)}</Text>
              <Text style={styles.gstColCell}>{fmtCurrency(data.total_sgst)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Taxable Amount</Text>
            <Text style={styles.totalValue}>{fmtCurrency(data.taxable_amount)}</Text>
          </View>
          {data.is_inter_state ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST</Text>
              <Text style={styles.totalValue}>{fmtCurrency(data.total_igst)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST</Text>
                <Text style={styles.totalValue}>{fmtCurrency(data.total_cgst)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST</Text>
                <Text style={styles.totalValue}>{fmtCurrency(data.total_sgst)}</Text>
              </View>
            </>
          )}
          <View style={[styles.grandTotalRow, { borderTopColor: t.dividerColor }]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: t.grandTotalColor }]}>{fmtCurrency(data.total_amount)}</Text>
          </View>
          {/* Amount in words */}
          {data.show_amount_in_words && (
            <View style={styles.amountInWordsRow}>
              <Text style={styles.amountInWordsText}>{amountInWords(data.total_amount)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Notes */}
      {data.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </View>
      )}

      {/* Terms & Conditions */}
      {data.terms && (
        <View style={styles.termsSection}>
          <Text style={styles.notesLabel}>Terms &amp; Conditions</Text>
          <Text style={styles.notesText}>{data.terms}</Text>
        </View>
      )}

      {/* e-Invoice details (IRN / ACK / QR) — mandatory when IRN is generated */}
      {data.e_invoice?.irn && (
        <View style={styles.eInvoiceSection}>
          <View style={styles.eInvoiceLeft}>
            <Text style={styles.eInvoiceSectionTitle}>e-Invoice Details (IRP Verified)</Text>
            <View style={styles.eInvoiceRow}>
              <Text style={styles.eInvoiceLabel}>IRN</Text>
              <Text style={styles.eInvoiceValue}>{data.e_invoice.irn}</Text>
            </View>
            {data.e_invoice.ack_no && (
              <View style={styles.eInvoiceRow}>
                <Text style={styles.eInvoiceLabel}>Ack. No.</Text>
                <Text style={styles.eInvoiceValue}>{data.e_invoice.ack_no}</Text>
              </View>
            )}
            {data.e_invoice.ack_date && (
              <View style={styles.eInvoiceRow}>
                <Text style={styles.eInvoiceLabel}>Ack. Date</Text>
                <Text style={styles.eInvoiceValue}>{fmtDate(data.e_invoice.ack_date)}</Text>
              </View>
            )}
          </View>
          {data.e_invoice.qr_data_url && (
            <Image style={styles.eInvoiceQr} src={data.e_invoice.qr_data_url} />
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Invoice #{data.invoice_number}</Text>
        <Text style={styles.footerText}>{effectiveFooter}</Text>
      </View>

      {/* Diagonal stamp overlay */}
      {effectiveStatusStyle === "stamp" && (
        <View style={styles.stampOverlay}>
          <View style={[styles.stampBorderBox, { borderColor: statusInfo.color }]}>
            <Text style={[styles.stampText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>
      )}
    </Page>
  );
}

export function InvoicePDF({
  data,
  documentTitle = "TAX INVOICE",
  documentLabel = "Invoice No.",
  printCopies = false,
}: {
  data: InvoicePDFData;
  documentTitle?: string;
  documentLabel?: string;
  printCopies?: boolean;
}) {
  if (printCopies) {
    return (
      <Document>
        <InvoicePage
          data={data}
          documentTitle={documentTitle}
          documentLabel={documentLabel}
          copyLabel="ORIGINAL FOR RECIPIENT"
        />
        <InvoicePage
          data={data}
          documentTitle={documentTitle}
          documentLabel={documentLabel}
          copyLabel="DUPLICATE FOR SUPPLIER"
        />
      </Document>
    );
  }
  return (
    <Document>
      <InvoicePage data={data} documentTitle={documentTitle} documentLabel={documentLabel} />
    </Document>
  );
}
