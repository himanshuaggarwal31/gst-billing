import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { stateLabel } from "@/lib/gst";
import { amountInWords, resolveAccentColor } from "@/lib/pdf-utils";

const THEME_ACCENTS: Record<string, string> = {
  classic: "#1a56db",
  minimal: "#6b7280",
  modern:  "#7c3aed",
};
const DEFAULT_ACCENT = "#1a56db";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 36,
    color: "#111",
  },
  // Header band — background is applied dynamically
  headerBand: {
    borderRadius: 4,
    padding: "10 14",
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  headerSubtitle: { fontSize: 8, color: "#bfdbfe", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  ewbNumber: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#fff" },
  ewbLabel: { fontSize: 7, color: "#bfdbfe", marginBottom: 2 },
  ewbValidLabel: { fontSize: 7, color: "#bfdbfe", marginTop: 4 },
  ewbValidValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#fef9c3" },
  // Section header
  sectionTitle: {
    fontSize: 7,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 12,
  },
  // Party boxes
  partiesRow: { flexDirection: "row", gap: 8 },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  partyLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyDetail: { fontSize: 8, color: "#374151", marginBottom: 1.5 },
  // Transport details — unified box
  transportBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  transportBoxLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  transportRow: { flexDirection: "row", marginBottom: 4 },
  transportField: { flex: 1 },
  transportFieldLabel: { fontSize: 6.5, color: "#9ca3af", marginBottom: 1.5 },
  transportFieldValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Table — header background applied dynamically
  tableHeader: {
    flexDirection: "row",
    padding: "5 6",
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    padding: "4 6",
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  // Column widths sum to 100%. Total is widened to 20% (was 10%) to prevent
  // long currency values (e.g. "Rs. 31,08,868.12") from wrapping to a second line.
  colSno:      { width: "4%",  fontSize: 7 },
  colDesc:     { width: "30%", fontSize: 7 },
  colHsn:      { width: "12%", fontSize: 7 },
  colQty:      { width: "8%",  fontSize: 7, textAlign: "right" },
  colTaxable:  { width: "18%", fontSize: 7, textAlign: "right" },
  colGst:      { width: "8%",  fontSize: 7, textAlign: "right" },
  colTotal:    { width: "20%", fontSize: 7, textAlign: "right" },
  thText: { color: "#fff", fontSize: 7, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 7.5, color: "#111" },
  // Totals
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsBox: { width: 220 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: "#555" },
  totalValue: { fontSize: 8, color: "#111" },
  grandLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    paddingTop: 4,
    marginTop: 3,
  },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  amountInWordsText: { fontSize: 7.5, color: "#555", fontStyle: "italic", marginTop: 4 },
  // Doc reference
  docRef: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: "5 8",
    flexDirection: "row",
    gap: 16,
  },
  docRefCell: { flex: 1 },
  docRefLabel: { fontSize: 6.5, color: "#9ca3af", marginBottom: 2 },
  docRefValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#aaa" },
  // Disclaimer
  disclaimer: {
    marginTop: 12,
    padding: "5 8",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 3,
  },
  disclaimerText: { fontSize: 7, color: "#92400e" },
});

export type EWayBillPDFData = {
  invoice_number: string;
  invoice_date: string;
  doc_label?: string;
  taxable_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  total_amount: number;
  is_inter_state: boolean;
  accent_color?: string | null;
  pdf_theme?: string | null;
  show_amount_in_words?: boolean | null;
  footer_text?: string | null;
  eway_bill: {
    eway_bill_number: string;
    valid_until: string | null;
    supply_type: string;
    sub_supply_type: number;
    transport_mode: string;
    distance_km: number;
    transporter_name: string | null;
    transporter_id: string | null;
    vehicle_no: string | null;
    vehicle_type: string;
    trans_doc_no: string | null;
    trans_doc_date: string | null;
  };
  seller: {
    business_name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string | null;
    pincode: string | null;
  };
  client: {
    name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string;
    pincode: string | null;
  };
  line_items: Array<{
    sort_order: number;
    description: string;
    hsn_sac_code: string;
    quantity: number;
    gst_rate: number;
    taxable_amount: number;
    line_total: number;
  }>;
};

const TRANSPORT_MODE_LABELS: Record<string, string> = {
  "1": "Road", "2": "Rail", "3": "Air", "4": "Ship / Water",
};

function fmtCurrency(n: number) {
  return `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function EWayBillPDF({ data }: { data: EWayBillPDFData }) {
  const lines = [...data.line_items].sort((a, b) => a.sort_order - b.sort_order);
  const ewb = data.eway_bill;
  const docLabel = data.doc_label ?? "Invoice";
  const isRoad = ewb.transport_mode === "1";
  const themeDefault = THEME_ACCENTS[data.pdf_theme ?? ""] ?? DEFAULT_ACCENT;
  const accent = resolveAccentColor(data.accent_color, themeDefault);
  const effectiveFooter = data.footer_text?.trim() || "This is a computer-generated document";

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header band */}
        <View style={[styles.headerBand, { backgroundColor: accent }]}>
          <View>
            <Text style={styles.headerTitle}>e-WAY BILL</Text>
            <Text style={styles.headerSubtitle}>Transport Document — carry with goods during transit</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.ewbLabel}>e-Way Bill No.</Text>
            <Text style={styles.ewbNumber}>{ewb.eway_bill_number}</Text>
            {ewb.valid_until && (
              <>
                <Text style={styles.ewbValidLabel}>Valid Until</Text>
                <Text style={styles.ewbValidValue}>{fmtDate(ewb.valid_until)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Invoice reference */}
        <View style={styles.docRef}>
          <View style={styles.docRefCell}>
            <Text style={styles.docRefLabel}>{docLabel} No.</Text>
            <Text style={styles.docRefValue}>{data.invoice_number}</Text>
          </View>
          <View style={styles.docRefCell}>
            <Text style={styles.docRefLabel}>{docLabel} Date</Text>
            <Text style={styles.docRefValue}>{fmtDate(data.invoice_date)}</Text>
          </View>
          <View style={styles.docRefCell}>
            <Text style={styles.docRefLabel}>Supply Type</Text>
            <Text style={styles.docRefValue}>{ewb.supply_type === "O" ? "Outward" : "Inward"}</Text>
          </View>
          <View style={styles.docRefCell}>
            <Text style={styles.docRefLabel}>Transaction Type</Text>
            <Text style={styles.docRefValue}>{data.is_inter_state ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}</Text>
          </View>
        </View>

        {/* From / To */}
        <Text style={styles.sectionTitle}>Consignor / Consignee</Text>
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>From (Consignor / Supplier)</Text>
            <Text style={styles.partyName}>{data.seller.business_name}</Text>
            {data.seller.gstin && <Text style={styles.partyDetail}>GSTIN: {data.seller.gstin}</Text>}
            {data.seller.address && <Text style={styles.partyDetail}>{data.seller.address}</Text>}
            {(data.seller.city || data.seller.pincode) && (
              <Text style={styles.partyDetail}>
                {[data.seller.city, data.seller.pincode].filter(Boolean).join(" – ")}
              </Text>
            )}
            {data.seller.state_code && (
              <Text style={styles.partyDetail}>State: {stateLabel(data.seller.state_code)}</Text>
            )}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>To (Consignee / Recipient)</Text>
            <Text style={styles.partyName}>{data.client.name}</Text>
            {data.client.gstin && <Text style={styles.partyDetail}>GSTIN: {data.client.gstin}</Text>}
            {data.client.address && <Text style={styles.partyDetail}>{data.client.address}</Text>}
            {(data.client.city || data.client.pincode) && (
              <Text style={styles.partyDetail}>
                {[data.client.city, data.client.pincode].filter(Boolean).join(" – ")}
              </Text>
            )}
            <Text style={styles.partyDetail}>State: {stateLabel(data.client.state_code)}</Text>
          </View>
        </View>

        {/* Transport details — unified box */}
        <View style={[styles.transportBox, { marginTop: 12 }]}>
          <Text style={styles.transportBoxLabel}>Transport Details</Text>
          {/* Row 1: Mode / Distance / Transporter / Transporter GSTIN */}
          <View style={styles.transportRow}>
            <View style={styles.transportField}>
              <Text style={styles.transportFieldLabel}>Mode</Text>
              <Text style={styles.transportFieldValue}>{TRANSPORT_MODE_LABELS[ewb.transport_mode] ?? ewb.transport_mode}</Text>
            </View>
            <View style={styles.transportField}>
              <Text style={styles.transportFieldLabel}>Distance (km)</Text>
              <Text style={styles.transportFieldValue}>{ewb.distance_km ?? "—"}</Text>
            </View>
            <View style={styles.transportField}>
              <Text style={styles.transportFieldLabel}>Transporter</Text>
              <Text style={styles.transportFieldValue}>{ewb.transporter_name || "—"}</Text>
            </View>
            <View style={styles.transportField}>
              <Text style={styles.transportFieldLabel}>Transporter GSTIN</Text>
              <Text style={styles.transportFieldValue}>{ewb.transporter_id || "—"}</Text>
            </View>
          </View>
          {/* Row 2 (Road): Vehicle No. / Vehicle Type */}
          {isRoad && (
            <View style={[styles.transportRow, { marginBottom: 0 }]}>
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Vehicle No.</Text>
                <Text style={styles.transportFieldValue}>{ewb.vehicle_no || "—"}</Text>
              </View>
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Vehicle Type</Text>
                <Text style={styles.transportFieldValue}>{ewb.vehicle_type === "O" ? "ODC" : "Regular"}</Text>
              </View>
              <View style={styles.transportField} />
              <View style={styles.transportField} />
            </View>
          )}
          {/* Row 2 (Non-Road): LR / RR / AWB No. + Doc Date */}
          {!isRoad && (ewb.trans_doc_no || ewb.trans_doc_date) && (
            <View style={[styles.transportRow, { marginBottom: 0 }]}>
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>LR / RR / AWB No.</Text>
                <Text style={styles.transportFieldValue}>{ewb.trans_doc_no || "—"}</Text>
              </View>
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Doc Date</Text>
                <Text style={styles.transportFieldValue}>{ewb.trans_doc_date ? fmtDate(ewb.trans_doc_date) : "—"}</Text>
              </View>
              <View style={styles.transportField} />
              <View style={styles.transportField} />
            </View>
          )}
        </View>

        {/* Line items */}
        <Text style={styles.sectionTitle}>Goods / Items</Text>
        <View style={[styles.tableHeader, { backgroundColor: accent }]}>
          <Text style={[styles.thText, styles.colSno]}>#</Text>
          <Text style={[styles.thText, styles.colDesc]}>Description</Text>
          <Text style={[styles.thText, styles.colHsn]}>HSN/SAC</Text>
          <Text style={[styles.thText, styles.colQty]}>Qty</Text>
          <Text style={[styles.thText, styles.colTaxable]}>Taxable Amt</Text>
          <Text style={[styles.thText, styles.colGst]}>GST%</Text>
          <Text style={[styles.thText, styles.colTotal]}>Total</Text>
        </View>
        {lines.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tdText, styles.colSno]}>{idx + 1}</Text>
            <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.tdText, styles.colHsn]}>{item.hsn_sac_code}</Text>
            <Text style={[styles.tdText, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.tdText, styles.colTaxable]}>{fmtCurrency(item.taxable_amount)}</Text>
            <Text style={[styles.tdText, styles.colGst]}>{item.gst_rate}%</Text>
            <Text style={[styles.tdText, styles.colTotal]}>{fmtCurrency(item.line_total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Taxable Amount</Text>
              <Text style={styles.totalValue}>{fmtCurrency(data.taxable_amount)}</Text>
            </View>
            {data.is_inter_state ? (
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>IGST</Text>
                <Text style={styles.totalValue}>{fmtCurrency(data.total_igst)}</Text>
              </View>
            ) : (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>CGST</Text>
                  <Text style={styles.totalValue}>{fmtCurrency(data.total_cgst)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>SGST</Text>
                  <Text style={styles.totalValue}>{fmtCurrency(data.total_sgst)}</Text>
                </View>
              </>
            )}
            <View style={[styles.grandLine, { borderTopColor: accent }]}>
              <Text style={styles.grandLabel}>Invoice Total</Text>
              <Text style={[styles.grandValue, { color: accent }]}>{fmtCurrency(data.total_amount)}</Text>
            </View>
            {data.show_amount_in_words && (
              <Text style={styles.amountInWordsText}>{amountInWords(data.total_amount)}</Text>
            )}
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This document is generated from GST Billing software. The e-Way Bill number above was obtained from the NIC e-Way Bill Portal (ewaybillgst.gov.in).
            This document must accompany the goods during transit. The driver / transporter is required to carry this document and present it on demand at any checkpost.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>e-Way Bill: {ewb.eway_bill_number}</Text>
          <Text style={styles.footerText}>Invoice #{data.invoice_number}</Text>
          <Text style={styles.footerText}>{effectiveFooter}</Text>
        </View>

      </Page>
    </Document>
  );
}
