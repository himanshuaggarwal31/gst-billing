/**
 * Common HSN (Harmonized System of Nomenclature) codes for goods
 * and SAC (Services Accounting Code) codes for services used in India.
 *
 * Used to provide autocomplete on invoice line items.
 * Source: GST Council rate schedule (simplified common-use list).
 */

export type HsnSacEntry = {
  code: string;
  description: string;
  gstRate: number; // default GST rate %
  type: "goods" | "service";
};

export const HSN_SAC_CODES: HsnSacEntry[] = [
  // ── SERVICES (SAC codes starting with 99) ──────────────────────────────
  { code: "998311", description: "Management consulting services", gstRate: 18, type: "service" },
  { code: "998312", description: "Business consulting services", gstRate: 18, type: "service" },
  { code: "998313", description: "Tax consulting and compliance services", gstRate: 18, type: "service" },
  { code: "998314", description: "Accounting and bookkeeping services", gstRate: 18, type: "service" },
  { code: "998315", description: "Payroll processing services", gstRate: 18, type: "service" },
  { code: "998316", description: "Related financial audit services", gstRate: 18, type: "service" },
  { code: "998321", description: "IT consulting and technology advisory", gstRate: 18, type: "service" },
  { code: "998322", description: "Software development and programming", gstRate: 18, type: "service" },
  { code: "998323", description: "Software maintenance and support", gstRate: 18, type: "service" },
  { code: "998324", description: "IT infrastructure provisioning and management", gstRate: 18, type: "service" },
  { code: "998331", description: "Internet hosting and cloud services", gstRate: 18, type: "service" },
  { code: "998332", description: "Application service provisioning (SaaS)", gstRate: 18, type: "service" },
  { code: "998399", description: "Other information technology services", gstRate: 18, type: "service" },
  { code: "998211", description: "Legal advisory and representation services", gstRate: 18, type: "service" },
  { code: "998212", description: "Arbitration and conciliation services", gstRate: 18, type: "service" },
  { code: "997212", description: "Rental of residential property", gstRate: 18, type: "service" },
  { code: "997213", description: "Rental of non-residential / commercial property", gstRate: 18, type: "service" },
  { code: "997221", description: "Property management services", gstRate: 18, type: "service" },
  { code: "996411", description: "Passenger transport — road (cab/taxi)", gstRate: 5, type: "service" },
  { code: "996421", description: "Courier / parcel delivery services", gstRate: 18, type: "service" },
  { code: "996511", description: "Air passenger transport (economy class)", gstRate: 5, type: "service" },
  { code: "996512", description: "Air passenger transport (business/first class)", gstRate: 12, type: "service" },
  { code: "996601", description: "Accommodation in hotels (room rate ≤₹7500/night)", gstRate: 12, type: "service" },
  { code: "996602", description: "Accommodation in hotels (room rate >₹7500/night)", gstRate: 18, type: "service" },
  { code: "996334", description: "Restaurant / catering services", gstRate: 5, type: "service" },
  { code: "998411", description: "Advertising services", gstRate: 18, type: "service" },
  { code: "998421", description: "Market research and public opinion polling", gstRate: 18, type: "service" },
  { code: "998431", description: "Photography and videography services", gstRate: 18, type: "service" },
  { code: "998441", description: "Event management and organisation", gstRate: 18, type: "service" },
  { code: "998451", description: "Trade fair and exhibition organisation", gstRate: 18, type: "service" },
  { code: "9985",   description: "Support services (staffing / security / cleaning)", gstRate: 18, type: "service" },
  { code: "9987",   description: "Maintenance, repair and installation services", gstRate: 18, type: "service" },
  { code: "9988",   description: "Manufacturing services on physical inputs owned by others", gstRate: 18, type: "service" },
  { code: "9989",   description: "Printing and publishing services", gstRate: 18, type: "service" },
  { code: "9991",   description: "Education and training services", gstRate: 0, type: "service" },
  { code: "9992",   description: "Healthcare / medical services", gstRate: 0, type: "service" },
  { code: "9993",   description: "Sewage, waste treatment and environmental services", gstRate: 5, type: "service" },
  { code: "9994",   description: "Sewage and refuse disposal services", gstRate: 18, type: "service" },
  { code: "9995",   description: "Membership organisation services", gstRate: 18, type: "service" },
  { code: "9997",   description: "Other personal services (laundry, beauty, etc.)", gstRate: 18, type: "service" },

  // ── GOODS (HSN codes) ──────────────────────────────────────────────────
  { code: "1001",   description: "Wheat and meslin", gstRate: 0, type: "goods" },
  { code: "1006",   description: "Rice", gstRate: 5, type: "goods" },
  { code: "1701",   description: "Cane sugar", gstRate: 5, type: "goods" },
  { code: "2106",   description: "Food preparations NEC (packaged food)", gstRate: 18, type: "goods" },
  { code: "2201",   description: "Water (packaged drinking water)", gstRate: 18, type: "goods" },
  { code: "2202",   description: "Aerated and flavoured water, fruit juices", gstRate: 12, type: "goods" },
  { code: "2402",   description: "Cigars, cheroots, cigarettes", gstRate: 28, type: "goods" },
  { code: "2710",   description: "Petroleum oils and lubricants", gstRate: 18, type: "goods" },
  { code: "3004",   description: "Medicines and pharmaceutical products", gstRate: 12, type: "goods" },
  { code: "3301",   description: "Essential oils (cosmetics / perfumes)", gstRate: 18, type: "goods" },
  { code: "3401",   description: "Soap and organic surface-active products", gstRate: 18, type: "goods" },
  { code: "3808",   description: "Insecticides, pesticides, herbicides", gstRate: 18, type: "goods" },
  { code: "3923",   description: "Plastic articles for packaging", gstRate: 18, type: "goods" },
  { code: "4901",   description: "Printed books (exempt)", gstRate: 0, type: "goods" },
  { code: "4902",   description: "Newspapers and periodicals", gstRate: 0, type: "goods" },
  { code: "4911",   description: "Printed matter (brochures, leaflets, etc.)", gstRate: 5, type: "goods" },
  { code: "6201",   description: "Men's or boys' overcoats and jackets", gstRate: 5, type: "goods" },
  { code: "6204",   description: "Women's or girls' suits and jackets", gstRate: 5, type: "goods" },
  { code: "6403",   description: "Footwear with leather uppers", gstRate: 18, type: "goods" },
  { code: "7213",   description: "Steel bars and rods (iron or non-alloy steel)", gstRate: 18, type: "goods" },
  { code: "7308",   description: "Structures, plates and shapes of iron/steel", gstRate: 18, type: "goods" },
  { code: "7606",   description: "Aluminium plates and sheets", gstRate: 18, type: "goods" },
  { code: "8414",   description: "Air pumps, fans, air-conditioning machines", gstRate: 28, type: "goods" },
  { code: "8415",   description: "Air conditioning machines", gstRate: 28, type: "goods" },
  { code: "8443",   description: "Printers, photocopiers, fax machines", gstRate: 18, type: "goods" },
  { code: "8450",   description: "Household washing machines", gstRate: 28, type: "goods" },
  { code: "8471",   description: "Computers, laptops, tablets", gstRate: 18, type: "goods" },
  { code: "8473",   description: "Computer parts and accessories", gstRate: 18, type: "goods" },
  { code: "8517",   description: "Mobile phones and smartphones", gstRate: 18, type: "goods" },
  { code: "8528",   description: "Monitors, televisions (>32 inch)", gstRate: 28, type: "goods" },
  { code: "8703",   description: "Motor vehicles for passenger transport (cars)", gstRate: 28, type: "goods" },
  { code: "8708",   description: "Parts and accessories of motor vehicles", gstRate: 28, type: "goods" },
  { code: "9001",   description: "Optical fibres and optical fibre bundles", gstRate: 18, type: "goods" },
  { code: "9403",   description: "Other furniture (office/wooden)", gstRate: 18, type: "goods" },
  { code: "9504",   description: "Video game consoles and games", gstRate: 28, type: "goods" },
  { code: "9506",   description: "Sports equipment and articles for exercise", gstRate: 18, type: "goods" },
];

/** Search HSN/SAC codes by partial code or description match */
export function searchHsnSac(query: string, limit = 10): HsnSacEntry[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return HSN_SAC_CODES.filter(
    (e) => e.code.startsWith(q) || e.description.toLowerCase().includes(q)
  ).slice(0, limit);
}
