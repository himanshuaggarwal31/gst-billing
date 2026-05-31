import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { stateLabel } from "@/lib/gst";
import { resolveAccentColor } from "@/lib/pdf-utils";

const DEFAULT_ACCENT = "#1a56db";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 36, color: "#111", backgroundColor: "#fff" },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, padding: "10 14", borderRadius: 3 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", letterSpacing: 0.5 },
  headerType: { fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 6.5, color: "rgba(255,255,255,0.65)", marginBottom: 1 },
  headerNo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#fff" },
  headerDate: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#fff", marginTop: 4 },

  // Info row
  infoRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  infoCell: { fontSize: 7.5, color: "#374151" },
  infoBold: { fontFamily: "Helvetica-Bold", color: "#111" },
  infoDot: { fontSize: 7.5, color: "#9ca3af" },

  // Parties
  partiesBox: { flexDirection: "row", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 3, marginBottom: 8, overflow: "hidden" },
  party: { flex: 1, padding: "8 10" },
  partyRight: { flex: 1, padding: "8 10", borderLeftWidth: 1, borderLeftColor: "#d1d5db" },
  partyTag: { fontSize: 6, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyGstin: { fontSize: 7.5, color: "#2563eb", marginBottom: 2 },
  partyLine: { fontSize: 7.5, color: "#374151", marginBottom: 1, lineHeight: 1.4 },

  // Locations strip
  locStrip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 3, backgroundColor: "#f9fafb", padding: "5 10", marginBottom: 8 },
  locLabel: { fontSize: 7, color: "#6b7280", marginRight: 4 },
  locName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#111", marginRight: 4 },
  locArrow: { fontSize: 8, color: "#9ca3af", marginHorizontal: 6 },

  // Transport
  transportBox: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 3, padding: "7 10", backgroundColor: "#f9fafb", marginBottom: 8 },
  transportTag: { fontSize: 6, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  transportRow: { flexDirection: "row" },
  transportCell: { flex: 1 },
  transportLabel: { fontSize: 6.5, color: "#9ca3af", marginBottom: 2 },
  transportValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  ewbBox: { borderWidth: 1, borderColor: "#93c5fd", borderRadius: 3, padding: "5 10", backgroundColor: "#eff6ff", flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  ewbLabel: { fontSize: 6, color: "#2563eb", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  ewbNo: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  ewbValidLabel: { fontSize: 6, color: "#93c5fd", marginBottom: 2 },
  ewbValidValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1e40af" },

  // Table
  sectionLabel: { fontSize: 6, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 6 },
  tableHead: { flexDirection: "row", padding: "4 6" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", padding: "4 6" },
  tableAlt: { backgroundColor: "#f9fafb" },
  tableFoot: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d1d5db", padding: "4 6", backgroundColor: "#f3f4f6" },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff" },
  td: { fontSize: 7.5, color: "#111" },
  c1: { width: "5%" },
  c2: { width: "38%" },
  c3: { width: "16%" },
  c4: { width: "11%", textAlign: "right" },
  c5: { width: "9%", textAlign: "center" },
  c6: { width: "21%" },

  // Notes
  notesBox: { borderWidth: 1, borderColor: "#fde68a", borderRadius: 3, padding: "5 8", backgroundColor: "#fffbeb", marginTop: 8 },
  notesLabel: { fontSize: 6, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  notesText: { fontSize: 8, color: "#374151" },

  // Signatures
  sigRow: { flexDirection: "row", gap: 8, marginTop: 28 },
  sigBox: { flex: 1, borderTopWidth: 1.5, borderTopColor: "#9ca3af", paddingTop: 6, alignItems: "center" },
  sigLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#374151" },
  sigSub: { fontSize: 7, color: "#9ca3af", marginTop: 1 },

  // Footer
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 4, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: "#aaa" },
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
  vehicle_number: string | null;
  driver_name: string | null;
  transporter_name: string | null;
  transporter_gstin: string | null;
  transport_mode: string | null;
  distance_km: number | null;
  eway_bill_number: string | null;
  eway_bill_valid_until: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
  from_location: { name: string; type: string; address: string | null } | null;
  to_location: { name: string; type: string; address: string | null } | null;
  clients: {
    name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string;
  } | null;
  challan_items: Array<{
    description: string;
    hsn_sac_code: string;
    quantity: number;
    unit: string;
    remarks: string | null;
    sort_order: number;
  }>;
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

const TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery Challan",
  job_work: "Job Work Challan",
  return: "Return Challan",
};

const MODE_LABELS: Record<string, string> = {
  road: "Road", "1": "Road",
  rail: "Rail", "2": "Rail",
  air: "Air",   "3": "Air",
  ship: "Ship",  "4": "Ship",
};

function fmt(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function ChallanPDF({ data }: { data: ChallanPDFData }) {
  const accent = resolveAccentColor(data.accent_color, DEFAULT_ACCENT);
  const items = [...data.challan_items].sort((a, b) => a.sort_order - b.sort_order);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const typeLabel = TYPE_LABELS[data.challan_type] ?? "Delivery Challan";
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  const returnable = data.returnable_type === "returnable" ? "Returnable" : "Non-Returnable";

  const sellerAddr = [data.seller.address, data.seller.city, data.seller.state_code ? stateLabel(data.seller.state_code) : null, data.seller.pincode].filter(Boolean).join(", ");
  const sellerPhone = data.seller.business_phone ?? data.seller.phone;

  const consignee = data.clients
    ? { name: data.clients.name, gstin: data.clients.gstin, addr: [data.clients.address, data.clients.city, stateLabel(data.clients.state_code)].filter(Boolean).join(", ") }
    : data.to_location
    ? { name: data.to_location.name, gstin: null, addr: data.to_location.address }
    : data.to_location_name
    ? { name: data.to_location_name, gstin: null, addr: null }
    : null;

  const fromName = data.from_location?.name ?? data.from_location_name;
  const toName   = data.to_location?.name   ?? data.to_location_name;

  const hasTransport = data.vehicle_number || data.driver_name || data.transporter_name || data.transport_mode || (data.distance_km ?? 0) > 0 || data.transporter_gstin;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={[s.header, { backgroundColor: accent }]}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>{typeLabel.toUpperCase()}</Text>
            <Text style={s.headerType}>{returnable}  |  {statusLabel}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerLabel}>Challan No.</Text>
            <Text style={s.headerNo}>{data.challan_number}</Text>
            <Text style={s.headerDate}>{fmt(data.challan_date)}</Text>
          </View>
        </View>

        {/* DATES INFO ROW */}
        {(data.dispatched_at || data.received_at) && (
          <View style={s.infoRow}>
            {data.dispatched_at && (
              <>
                <Text style={s.infoCell}>Dispatched: </Text>
                <Text style={[s.infoCell, s.infoBold]}>{fmt(data.dispatched_at)}</Text>
              </>
            )}
            {data.dispatched_at && data.received_at && <Text style={s.infoDot}>  |  </Text>}
            {data.received_at && (
              <>
                <Text style={s.infoCell}>Received: </Text>
                <Text style={[s.infoCell, s.infoBold]}>{fmt(data.received_at)}</Text>
              </>
            )}
          </View>
        )}

        {/* PARTIES */}
        <View style={s.partiesBox}>
          <View style={s.party}>
            <Text style={s.partyTag}>Dispatch From (Consignor)</Text>
            <Text style={s.partyName}>{data.seller.business_name}</Text>
            {data.seller.gstin ? <Text style={s.partyGstin}>GSTIN: {data.seller.gstin}</Text> : null}
            {sellerAddr ? <Text style={s.partyLine}>{sellerAddr}</Text> : null}
            {sellerPhone ? <Text style={s.partyLine}>Ph: {sellerPhone}</Text> : null}
            {data.seller.business_email ? <Text style={s.partyLine}>{data.seller.business_email}</Text> : null}
          </View>
          <View style={s.partyRight}>
            <Text style={s.partyTag}>Ship To (Consignee)</Text>
            {consignee ? (
              <>
                <Text style={s.partyName}>{consignee.name}</Text>
                {consignee.gstin ? <Text style={s.partyGstin}>GSTIN: {consignee.gstin}</Text> : null}
                {consignee.addr ? <Text style={s.partyLine}>{consignee.addr}</Text> : null}
              </>
            ) : (
              <Text style={s.partyLine}>-</Text>
            )}
          </View>
        </View>

        {/* LOCATIONS STRIP */}
        {(fromName || toName) ? (
          <View style={s.locStrip}>
            {fromName ? <><Text style={s.locLabel}>From:</Text><Text style={s.locName}>{fromName}</Text></> : null}
            {fromName && toName ? <Text style={s.locArrow}>{"->"}</Text> : null}
            {toName ? <><Text style={s.locLabel}>To:</Text><Text style={s.locName}>{toName}</Text></> : null}
          </View>
        ) : null}

        {/* TRANSPORT */}
        {hasTransport ? (
          <View style={s.transportBox}>
            <Text style={s.transportTag}>Transport Details</Text>
            <View style={s.transportRow}>
              {data.vehicle_number ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Vehicle No.</Text>
                  <Text style={s.transportValue}>{data.vehicle_number.toUpperCase()}</Text>
                </View>
              ) : null}
              {data.driver_name ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Driver</Text>
                  <Text style={s.transportValue}>{data.driver_name}</Text>
                </View>
              ) : null}
              {data.transporter_name ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Transporter</Text>
                  <Text style={s.transportValue}>{data.transporter_name}</Text>
                </View>
              ) : null}
              {data.transport_mode ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Mode</Text>
                  <Text style={s.transportValue}>{MODE_LABELS[data.transport_mode] ?? data.transport_mode}</Text>
                </View>
              ) : null}
              {(data.distance_km ?? 0) > 0 ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Distance</Text>
                  <Text style={s.transportValue}>{data.distance_km} km</Text>
                </View>
              ) : null}
              {data.transporter_gstin ? (
                <View style={s.transportCell}>
                  <Text style={s.transportLabel}>Transporter GSTIN</Text>
                  <Text style={s.transportValue}>{data.transporter_gstin}</Text>
                </View>
              ) : null}
            </View>
            {data.eway_bill_number ? (
              <View style={s.ewbBox}>
                <View>
                  <Text style={s.ewbLabel}>e-Way Bill No.</Text>
                  <Text style={s.ewbNo}>{data.eway_bill_number}</Text>
                </View>
                {data.eway_bill_valid_until ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.ewbValidLabel}>Valid Until</Text>
                    <Text style={s.ewbValidValue}>{fmt(data.eway_bill_valid_until)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ITEMS */}
        <Text style={s.sectionLabel}>Items / Goods</Text>
        <View style={[s.tableHead, { backgroundColor: accent }]}>
          <Text style={[s.th, s.c1]}>#</Text>
          <Text style={[s.th, s.c2]}>Description</Text>
          <Text style={[s.th, s.c3]}>HSN / SAC</Text>
          <Text style={[s.th, s.c4]}>Qty</Text>
          <Text style={[s.th, s.c5]}>Unit</Text>
          <Text style={[s.th, s.c6]}>Remarks</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableAlt : {}]}>
            <Text style={[s.td, s.c1]}>{i + 1}</Text>
            <Text style={[s.td, s.c2]}>{item.description}</Text>
            <Text style={[s.td, s.c3]}>{item.hsn_sac_code || "-"}</Text>
            <Text style={[s.td, s.c4]}>{item.quantity}</Text>
            <Text style={[s.td, s.c5]}>{item.unit}</Text>
            <Text style={[s.td, s.c6]}>{item.remarks || "-"}</Text>
          </View>
        ))}
        <View style={s.tableFoot}>
          <Text style={[s.c1, { fontSize: 7 }]}> </Text>
          <Text style={[s.c2, { fontSize: 7.5, fontFamily: "Helvetica-Bold" }]}>Total: {items.length} item{items.length !== 1 ? "s" : ""}</Text>
          <Text style={[s.c3, { fontSize: 7 }]}> </Text>
          <Text style={[s.c4, { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }]}>{totalQty}</Text>
          <Text style={[s.c5, { fontSize: 7 }]}> </Text>
          <Text style={[s.c6, { fontSize: 7 }]}> </Text>
        </View>

        {/* NOTES */}
        {data.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        {/* SIGNATURES */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Prepared By</Text>
            <Text style={s.sigSub}>(Authorised Signatory)</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Driver / Carrier</Text>
            <Text style={s.sigSub}>(Name and Signature)</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Received By</Text>
            <Text style={s.sigSub}>(Stamp and Signature)</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.challan_number} - {typeLabel}</Text>
          <Text style={s.footerText}>Computer-generated document</Text>
        </View>

      </Page>
    </Document>
  );
}

