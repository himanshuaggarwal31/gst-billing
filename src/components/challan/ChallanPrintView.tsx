/**
 * ChallanPrintView — rendered inside the detail page, shown only when printing.
 * Uses plain HTML/CSS so window.print() produces a clean A4 challan.
 */

type ChallanItem = {
  id: string;
  description: string;
  hsn_sac_code: string;
  quantity: number;
  unit: string;
  remarks: string | null;
  sort_order: number;
};

type ChallanData = {
  challan_number: string;
  challan_date: string;
  challan_type: "delivery" | "job_work" | "return";
  returnable_type: "returnable" | "non_returnable";
  status: string;
  from_location_name: string | null;
  to_location_name: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  transporter_name: string | null;
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  returned_at: string | null;
  clients: {
    name: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state_code: string;
  } | null;
  from_location: { name: string; type: string; address: string | null } | null;
  to_location: { name: string; type: string; address: string | null } | null;
  challan_items: ChallanItem[];
};

const TYPE_LABEL: Record<string, string> = {
  delivery: "DELIVERY CHALLAN",
  job_work: "JOB WORK CHALLAN",
  return:   "RETURN CHALLAN",
};

export default function ChallanPrintView({ challan }: { challan: ChallanData }) {
  const sortedItems = [...challan.challan_items].sort((a, b) => a.sort_order - b.sort_order);
  const dateStr = new Date(challan.challan_date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111", padding: 24, maxWidth: 794 }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #1a56db", paddingBottom: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a56db" }}>
            {TYPE_LABEL[challan.challan_type] ?? "DELIVERY CHALLAN"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
            {challan.returnable_type === "returnable" ? "Returnable" : "Non-Returnable"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{challan.challan_number}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>Date: {dateStr}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#777", textTransform: "uppercase" }}>{challan.status}</p>
        </div>
      </div>

      {/* From / To */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, backgroundColor: "#f9fafb" }}>
          <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>FROM</p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {challan.from_location?.name ?? challan.from_location_name ?? "—"}
          </p>
          {challan.from_location?.address && (
            <p style={{ margin: "2px 0 0", color: "#555", fontSize: 10 }}>{challan.from_location.address}</p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 18, color: "#9ca3af" }}>→</div>
        <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, backgroundColor: "#f9fafb" }}>
          <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>TO</p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {challan.to_location?.name ?? challan.to_location_name ?? "—"}
          </p>
          {challan.to_location?.address && (
            <p style={{ margin: "2px 0 0", color: "#555", fontSize: 10 }}>{challan.to_location.address}</p>
          )}
        </div>
        {challan.clients && (
          <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, backgroundColor: "#f9fafb" }}>
            <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>CLIENT</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{challan.clients.name}</p>
            {challan.clients.gstin && (
              <p style={{ margin: "2px 0 0", fontSize: 9, fontFamily: "monospace" }}>GSTIN: {challan.clients.gstin}</p>
            )}
          </div>
        )}
      </div>

      {/* Transport details */}
      {(challan.vehicle_number || challan.driver_name || challan.transporter_name) && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, padding: "8px 12px", backgroundColor: "#eff6ff", borderRadius: 6, border: "1px solid #bfdbfe" }}>
          {challan.vehicle_number && (
            <div>
              <span style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>Vehicle: </span>
              <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{challan.vehicle_number}</span>
            </div>
          )}
          {challan.driver_name && (
            <div>
              <span style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>Driver: </span>
              <span style={{ fontWeight: 600 }}>{challan.driver_name}</span>
            </div>
          )}
          {challan.transporter_name && (
            <div>
              <span style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>Transporter: </span>
              <span style={{ fontWeight: 600 }}>{challan.transporter_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ backgroundColor: "#1a56db", color: "#fff" }}>
            <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>#</th>
            <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Description of Goods</th>
            <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600 }}>HSN/SAC</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, fontWeight: 600 }}>Qty</th>
            <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Unit</th>
            <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, i) => (
            <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#9ca3af" }}>{i + 1}</td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 500 }}>{item.description}</td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center", fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>
                {item.hsn_sac_code || "—"}
              </td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>{item.unit}</td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#9ca3af", fontSize: 10 }}>{item.remarks || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#eff6ff" }}>
            <td colSpan={3} style={{ padding: "6px 8px", fontWeight: 600, fontSize: 10 }}>Total Items: {sortedItems.length}</td>
            <td colSpan={3} style={{ padding: "6px 8px", textAlign: "right", fontSize: 9, color: "#6b7280", fontStyle: "italic" }}>
              {challan.returnable_type === "returnable"
                ? "✓ Goods are returnable — please return after use"
                : "Non-returnable goods"}
            </td>
          </tr>
        </tfoot>
      </table>

      {challan.notes && (
        <div style={{ marginBottom: 16, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <p style={{ margin: "0 0 2px", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Notes</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{challan.notes}</p>
        </div>
      )}

      {/* Signature boxes */}
      <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
        <div style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "12px 12px 40px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 9, color: "#6b7280" }}>Prepared By</p>
        </div>
        <div style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "12px 12px 40px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 9, color: "#6b7280" }}>Dispatched By / Driver Signature</p>
        </div>
        <div style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "12px 12px 40px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 9, color: "#6b7280" }}>Received By</p>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 9, color: "#9ca3af" }}>
        This is a computer generated delivery challan.
      </p>
    </div>
  );
}
