/**
 * Feature registry — canonical list of all feature IDs used for access control.
 * Add new features here first, then add them to the DB features table via migration.
 */

export const FEATURE_IDS = [
  "invoices",
  "quotations",
  "clients",
  "products",
  "expenses",
  "recurring",
  "credit_notes",
  "payments",
  "gst_reports",
  "eway_bills",
  "e_invoices",
  "analytics",
  "aging_reports",
  "import",
  "team",
  "pdf_customization",
  "admin_panel",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureSource = "plan" | "override" | "super_admin";

export type FeatureAccess = {
  enabled: boolean;
  limits: Record<string, number>;
  source: FeatureSource;
  expiresAt?: string | null;
};

/**
 * Map of featureId → access descriptor.
 * A missing entry means the feature is NOT accessible.
 */
export type FeatureAccessMap = Partial<Record<FeatureId, FeatureAccess>>;

/**
 * Returns true if the feature is explicitly enabled in the access map.
 */
export function hasFeature(map: FeatureAccessMap, feature: FeatureId): boolean {
  return map[feature]?.enabled === true;
}

/**
 * Returns the numeric limit for a given key within a feature.
 * Returns Infinity when the limit is absent or set to -1 (unlimited).
 * Returns 0 when the feature is not accessible.
 */
export function getFeatureLimit(
  map: FeatureAccessMap,
  feature: FeatureId,
  limitKey: string
): number {
  const entry = map[feature];
  if (!entry?.enabled) return 0;
  const raw = entry.limits?.[limitKey];
  if (raw === undefined || raw === null) return Infinity;
  if (raw === -1) return Infinity;
  return raw;
}

/**
 * Sidebar nav item descriptor used by DashboardNav.
 */
export type NavItem = {
  label: string;
  href: string;
  feature?: FeatureId;       // if set, item is hidden when feature is not accessible
  adminOnly?: boolean;       // if true, only visible to super admins
};

/**
 * Full navigation definition — single source of truth for sidebar.
 * The `feature` field is matched against the user's FeatureAccessMap.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard" },
  { label: "Invoices",      href: "/dashboard/invoices",      feature: "invoices" },
  { label: "Quotations",    href: "/dashboard/quotations",    feature: "quotations" },
  { label: "Clients",       href: "/dashboard/clients",       feature: "clients" },
  { label: "Products",      href: "/dashboard/products",      feature: "products" },
  { label: "Expenses",      href: "/dashboard/expenses",      feature: "expenses" },
  { label: "Recurring",     href: "/dashboard/recurring",     feature: "recurring" },
  { label: "Credit Notes",  href: "/dashboard/credit-notes",  feature: "credit_notes" },
  { label: "GST Reports",   href: "/dashboard/gst-reports",   feature: "gst_reports" },
  { label: "Aging",         href: "/dashboard/reports/aging", feature: "aging_reports" },
  { label: "Analytics",     href: "/dashboard/analytics",     feature: "analytics" },
  { label: "Import",        href: "/dashboard/import",        feature: "import" },
  { label: "Team",          href: "/dashboard/team",          feature: "team" },
  { label: "Settings",      href: "/dashboard/settings" },
  { label: "Admin",         href: "/dashboard/admin",         adminOnly: true },
];
