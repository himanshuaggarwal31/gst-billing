import { z } from "zod";

// Indian state codes for GST
export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

// Standard state abbreviations (vehicle registration / ISO codes) for display
export const STATE_ABBR: Record<string, string> = {
  "01": "JK", "02": "HP", "03": "PB", "04": "CH", "05": "UK",
  "06": "HR", "07": "DL", "08": "RJ", "09": "UP", "10": "BR",
  "11": "SK", "12": "AR", "13": "NL", "14": "MN", "15": "MZ",
  "16": "TR", "17": "ML", "18": "AS", "19": "WB", "20": "JH",
  "21": "OD", "22": "CG", "23": "MP", "24": "GJ", "26": "DN",
  "27": "MH", "28": "AP", "29": "KA", "30": "GA", "31": "LD",
  "32": "KL", "33": "TN", "34": "PY", "35": "AN", "36": "TS",
  "37": "AP", "38": "LA", "97": "OT", "99": "CJ",
};

/** Returns display label like "HR — Haryana" for numeric GST state code "06" */
export function stateLabel(code: string): string {
  const c = code.trim();
  const abbr = STATE_ABBR[c];
  const name = INDIAN_STATE_CODES[c];
  if (!abbr && !name) return c || "—";
  return `${abbr ?? c} — ${name ?? c}`;
}

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity + Z + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGSTIN(gstin: string): boolean {
  if (!GSTIN_REGEX.test(gstin)) return false;
  const stateCode = gstin.substring(0, 2);
  return stateCode in INDIAN_STATE_CODES;
}

export function getStateCodeFromGSTIN(gstin: string): string {
  return gstin.substring(0, 2);
}

export const LineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  hsnSacCode: z.string().min(4, "HSN/SAC code must be at least 4 digits"),
  quantity: z.number().positive("Quantity must be positive"),
  rate: z.number().positive("Rate must be positive"),
  gstRate: z.number().min(0).max(28, "GST rate must be between 0 and 28"),
  discountPercent: z.number().min(0).max(100).default(0),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export type GSTBreakdown = {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalAmount: number;
};

export type LineItemCalculated = LineItem & {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  lineTotal: number;
};

export function calculateLineItem(
  item: LineItem,
  isInterState: boolean
): LineItemCalculated {
  const grossAmount = item.quantity * item.rate;
  const discountAmount = (grossAmount * item.discountPercent) / 100;
  const taxableAmount = Math.round((grossAmount - discountAmount) * 100) / 100;

  const totalGst = Math.round((taxableAmount * item.gstRate) / 100 * 100) / 100;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = totalGst;
  } else {
    cgst = Math.round((totalGst / 2) * 100) / 100;
    sgst = Math.round((totalGst / 2) * 100) / 100;
  }

  return {
    ...item,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalGst,
    lineTotal: taxableAmount + totalGst,
  };
}

export function calculateInvoiceTotals(
  items: LineItem[],
  sellerStateCode: string,
  buyerStateCode: string
): { lines: LineItemCalculated[]; summary: GSTBreakdown } {
  const isInterState = sellerStateCode.trim() !== buyerStateCode.trim();

  const lines = items.map((item) => calculateLineItem(item, isInterState));

  const summary: GSTBreakdown = lines.reduce(
    (acc, line) => ({
      taxableAmount: Math.round((acc.taxableAmount + line.taxableAmount) * 100) / 100,
      cgst: Math.round((acc.cgst + line.cgst) * 100) / 100,
      sgst: Math.round((acc.sgst + line.sgst) * 100) / 100,
      igst: Math.round((acc.igst + line.igst) * 100) / 100,
      totalGst: Math.round((acc.totalGst + line.totalGst) * 100) / 100,
      totalAmount: Math.round((acc.totalAmount + line.lineTotal) * 100) / 100,
    }),
    { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, totalAmount: 0 }
  );

  return { lines, summary };
}

export const GST_RATES = [0, 5, 12, 18, 28] as const;
