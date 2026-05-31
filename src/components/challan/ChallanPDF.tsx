import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { stateLabel } from "@/lib/gst";
import { resolveAccentColor } from "@/lib/pdf-utils";

const DEFAULT_ACCENT = "#1a56db";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 36,
    color: "#111",
  },
  // Header band
  headerBand: {
    borderRadius: 4,
    padding: "10 14",
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  headerSubtitle: { fontSize: 7.5, color: "#bfdbfe", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerChallanNo: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#fff" },
  headerLabel: { fontSize: 7, color: "#bfdbfe", marginBottom: 1 },
  headerValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fef9c3", marginBottom: 4 },
  // Section header
  sectionTitle: {
    fontSize: 7,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 10,
  },
  // Seller box
  sellerBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  sellerLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  sellerName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sellerDetail: { fontSize: 8, color: "#374151", marginBottom: 1.5 },
  sellerRow: { flexDirection: "row", gap: 16 },
  sellerCol: { flex: 1 },
  // Location boxes
  movementRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  locationBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  locationLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  locationName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  locationDetail: { fontSize: 8, color: "#374151", marginBottom: 1 },
  locationTypeBadge: { fontSize: 7, color: "#6b7280", marginTop: 2 },
  // Arrow between locations
  arrowBox: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 22,
  },
  arrowText: { fontSize: 18, color: "#9ca3af" },
  // Client box
  clientBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  // Transport + EWB box
  transportBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  transportBoxLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  transportRow: { flexDirection: "row", marginBottom: 4 },
  transportField: { flex: 1 },
  transportFieldLabel: { fontSize: 6.5, color: "#9ca3af", marginBottom: 1.5 },
  transportFieldValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  ewbHighlight: {
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    borderRadius: 4,
    padding: "4 8",
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  ewbHighlightLabel: { fontSize: 7, color: "#2563eb", textTransform: "uppercase", letterSpacing: 0.5 },
  ewbHighlightNumber: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  ewbHighlightRight: { alignItems: "flex-end" },
  ewbHighlightValidLabel: { fontSize: 6.5, color: "#93c5fd" },
  ewbHighlightValidValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1e40af" },
  // Items table
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
  colSno:      { width: "5%",  fontSize: 7 },
  colDesc:     { width: "35%", fontSize: 7 },
  colHsn:      { width: "15%", fontSize: 7 },
  colQty:      { width: "12%", fontSize: 7, textAlign: "right" },
  colUnit:     { width: "10%", fontSize: 7, textAlign: "right" },
  colRemarks:  { width: "23%", fontSize: 7 },
  thText: { color: "#fff", fontSize: 7, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 7.5, color: "#111" },
  totalQtyRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderTopColor: "#e5e7eb",
    padding: "4 6",
    marginTop: 2,
  },
  // Notes
  notesBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#fffbeb",
    marginTop: 8,
  },
  notesLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  notesText: { fontSize: 8, color: "#374151" },
  // Signature row
  signatureRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  signatureBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#9ca3af",
    paddingTop: 5,
    alignItems: "center",
  },
  signatureLabel: { fontSize: 7.5, color: "#6b7280" },
  signatureSubLabel: { fontSize: 7, color: "#9ca3af", marginTop: 1 },
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
});

export type ChallanPDFData = {
  challan_number: string;
  challan_date: string;
  challan_type: "delivery" | "job_work" | "return";
  returnable_type: "returnable" | "non_returnable";
  status: "draft" | "dispatched" | "received" | "returned";
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  returned_at: string | null;

  // Transport
  vehicle_number: string | null;
  driver_name: string | null;
  transporter_name: string | null;
  transporter_gstin: string | null;
  transport_mode: string | null;
  distance_km: number | null;

  // E-Way Bill
  eway_bill_number: string | null;
  eway_bill_valid_until: string | null;

  // Locations
  from_location_name: string | null;
  to_location_name: string | null;
  from_location: { name: string; type: string; address: string | null } | null;
  to_location: { name: string; type: string; address: string | null } | null;

  // Client (optional)
  clients: {
    name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string;
  } | null;

  // Items
  challan_items: Array<{
    description: string;
    hsn_sac_code: string;
    quantity: number;
    unit: string;
    remarks: string | null;
    sort_order: number;
  }>;

  // Seller (from profile)
  seller: {
    business_name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string | null;
    pincode: string | null;
    phone: string | null;
    business_phone: string | null;
    business_email: string | null;
  };

  accent_color?: string | null;
};

const CHALLAN_TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery Challan",
  job_work: "Job Work Challan",
  return:   "Return Challan",
};

const TRANSPORT_MODE_LABELS: Record<string, string> = {
  road: "Road", rail: "Rail", air: "Air", ship: "Ship / Water",
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  warehouse: "Warehouse",
  project_site: "Project Site",
  other: "Other",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function ChallanPDF({ data }: { data: ChallanPDFData }) {
  const accent = resolveAccentColor(data.accent_color, DEFAULT_ACCENT);
  const items = [...data.challan_items].sort((a, b) => a.sort_order - b.sort_order);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const typeLabel = CHALLAN_TYPE_LABELS[data.challan_type] ?? "Delivery Challan";
  const isReturnable = data.returnable_type === "returnable";

  const fromName = data.from_location?.name ?? data.from_location_name ?? "—";
  const toName   = data.to_location?.name   ?? data.to_location_name   ?? "—";
  const fromAddr = data.from_location?.address ?? null;
  const toAddr   = data.to_location?.address   ?? null;
  const fromType = data.from_location?.type ?? null;
  const toType   = data.to_location?.type   ?? null;

  const sellerAddr = [data.seller.address, data.seller.city, data.seller.state_code ? stateLabel(data.seller.state_code) : null, data.seller.pincode]
    .filter(Boolean).join(", ");
  const sellerContact = data.seller.business_phone ?? data.seller.phone ?? null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header band */}
        <View style={[styles.headerBand, { backgroundColor: accent }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{typeLabel.toUpperCase()}</Text>
            <Text style={styles.headerSubtitle}>
              {isReturnable ? "Returnable" : "Non-Returnable"} • {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>Challan No.</Text>
            <Text style={styles.headerChallanNo}>{data.challan_number}</Text>
            <Text style={styles.headerLabel}>Date</Text>
            <Text style={styles.headerValue}>{fmtDate(data.challan_date)}</Text>
            {data.dispatched_at && (
              <>
                <Text style={styles.headerLabel}>Dispatched</Text>
                <Text style={styles.headerValue}>{fmtDate(data.dispatched_at)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Seller / Issuing Business */}
        <View style={styles.sellerBox}>
          <Text style={styles.sellerLabel}>Issued By</Text>
          <View style={styles.sellerRow}>
            <View style={styles.sellerCol}>
              <Text style={styles.sellerName}>{data.seller.business_name}</Text>
              {sellerAddr ? <Text style={styles.sellerDetail}>{sellerAddr}</Text> : null}
            </View>
            <View style={styles.sellerCol}>
              {data.seller.gstin && (
                <Text style={styles.sellerDetail}>GSTIN: {data.seller.gstin}</Text>
              )}
              {sellerContact && (
                <Text style={styles.sellerDetail}>Ph: {sellerContact}</Text>
              )}
              {data.seller.business_email && (
                <Text style={styles.sellerDetail}>{data.seller.business_email}</Text>
              )}
            </View>
          </View>
        </View>

        {/* From → To Movement */}
        <Text style={styles.sectionTitle}>Goods Movement</Text>
        <View style={styles.movementRow}>
          <View style={styles.locationBox}>
            <Text style={styles.locationLabel}>From</Text>
            <Text style={styles.locationName}>{fromName}</Text>
            {fromAddr && <Text style={styles.locationDetail}>{fromAddr}</Text>}
            {fromType && <Text style={styles.locationTypeBadge}>({LOCATION_TYPE_LABELS[fromType] ?? fromType})</Text>}
          </View>
          <View style={styles.arrowBox}>
            <Text style={styles.arrowText}>→</Text>
          </View>
          <View style={styles.locationBox}>
            <Text style={styles.locationLabel}>To</Text>
            <Text style={styles.locationName}>{toName}</Text>
            {toAddr && <Text style={styles.locationDetail}>{toAddr}</Text>}
            {toType && <Text style={styles.locationTypeBadge}>({LOCATION_TYPE_LABELS[toType] ?? toType})</Text>}
          </View>
        </View>

        {/* Client (if linked) */}
        {data.clients && (
          <>
            <Text style={styles.sectionTitle}>Client</Text>
            <View style={styles.clientBox}>
              <Text style={[styles.locationName, { marginBottom: 2 }]}>{data.clients.name}</Text>
              {data.clients.gstin && (
                <Text style={styles.locationDetail}>GSTIN: {data.clients.gstin}</Text>
              )}
              {data.clients.address && (
                <Text style={styles.locationDetail}>{[data.clients.address, data.clients.city, stateLabel(data.clients.state_code)].filter(Boolean).join(", ")}</Text>
              )}
            </View>
          </>
        )}

        {/* Transport Details */}
        <Text style={styles.sectionTitle}>Transport Details</Text>
        <View style={styles.transportBox}>
          <View style={styles.transportRow}>
            {data.vehicle_number && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Vehicle No.</Text>
                <Text style={styles.transportFieldValue}>{data.vehicle_number}</Text>
              </View>
            )}
            {data.driver_name && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Driver</Text>
                <Text style={styles.transportFieldValue}>{data.driver_name}</Text>
              </View>
            )}
            {data.transporter_name && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Transporter</Text>
                <Text style={styles.transportFieldValue}>{data.transporter_name}</Text>
              </View>
            )}
            {data.transport_mode && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Mode</Text>
                <Text style={styles.transportFieldValue}>{TRANSPORT_MODE_LABELS[data.transport_mode] ?? data.transport_mode}</Text>
              </View>
            )}
            {data.distance_km != null && data.distance_km > 0 && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Distance</Text>
                <Text style={styles.transportFieldValue}>{data.distance_km} km</Text>
              </View>
            )}
            {data.transporter_gstin && (
              <View style={styles.transportField}>
                <Text style={styles.transportFieldLabel}>Transporter GSTIN</Text>
                <Text style={styles.transportFieldValue}>{data.transporter_gstin}</Text>
              </View>
            )}
          </View>

          {/* E-Way Bill highlight */}
          {data.eway_bill_number && (
            <View style={styles.ewbHighlight}>
              <View>
                <Text style={styles.ewbHighlightLabel}>e-Way Bill No.</Text>
                <Text style={styles.ewbHighlightNumber}>{data.eway_bill_number}</Text>
              </View>
              {data.eway_bill_valid_until && (
                <View style={styles.ewbHighlightRight}>
                  <Text style={styles.ewbHighlightValidLabel}>Valid Until</Text>
                  <Text style={styles.ewbHighlightValidValue}>{fmtDate(data.eway_bill_valid_until)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Items Table */}
        <Text style={styles.sectionTitle}>Items / Goods</Text>
        <View style={[styles.tableHeader, { backgroundColor: accent }]}>
          <Text style={[styles.thText, styles.colSno]}>#</Text>
          <Text style={[styles.thText, styles.colDesc]}>Description</Text>
          <Text style={[styles.thText, styles.colHsn]}>HSN/SAC</Text>
          <Text style={[styles.thText, styles.colQty]}>Qty</Text>
          <Text style={[styles.thText, styles.colUnit]}>Unit</Text>
          <Text style={[styles.thText, styles.colRemarks]}>Remarks</Text>
        </View>
        {items.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tdText, styles.colSno]}>{idx + 1}</Text>
            <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.tdText, styles.colHsn]}>{item.hsn_sac_code || "—"}</Text>
            <Text style={[styles.tdText, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.tdText, styles.colUnit]}>{item.unit}</Text>
            <Text style={[styles.tdText, styles.colRemarks]}>{item.remarks ?? "—"}</Text>
          </View>
        ))}
        {/* Total row */}
        <View style={styles.totalQtyRow}>
          <Text style={[{ width: "5%", fontSize: 7 }]}> </Text>
          <Text style={[{ width: "35%", fontSize: 7, fontFamily: "Helvetica-Bold" }]}>Total Items: {items.length}</Text>
          <Text style={[{ width: "15%", fontSize: 7 }]}> </Text>
          <Text style={[{ width: "12%", fontSize: 7, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{totalQty}</Text>
          <Text style={[{ width: "10%", fontSize: 7 }]}> </Text>
          <Text style={[{ width: "23%", fontSize: 7 }]}> </Text>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Signature Boxes */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Prepared By</Text>
            <Text style={styles.signatureSubLabel}>(Authorised Signatory)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Driver / Carrier</Text>
            <Text style={styles.signatureSubLabel}>(Name &amp; Signature)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Received By</Text>
            <Text style={styles.signatureSubLabel}>(Stamp &amp; Signature)</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{data.challan_number} — {typeLabel}</Text>
          <Text style={styles.footerText}>This is a computer-generated document</Text>
        </View>

      </Page>
    </Document>
  );
}
