"use client";

import type { ReactNode } from "react";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import type { FeatureId } from "@/lib/features";

type Props = {
  feature: FeatureId;
  /** Rendered when the user has access */
  children: ReactNode;
  /** Optional fallback rendered when access is denied */
  fallback?: ReactNode;
};

/**
 * Conditionally renders children only when the user has access to the feature.
 * Renders nothing (or `fallback`) while loading or when access is denied.
 *
 * Usage:
 *   <FeatureGate feature="analytics">
 *     <AnalyticsDashboard />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback = null }: Props) {
  const { can, isLoading } = useFeatureAccess();
  if (isLoading) return null;
  return can(feature) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Returns true when the user has access to a feature (hook form).
 * Pair with the context hook for more granular checks.
 */
export { useFeatureAccess } from "@/context/FeatureAccessContext";
