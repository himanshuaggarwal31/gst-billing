"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { FeatureAccessMap, FeatureId } from "@/lib/features";
import { hasFeature, getFeatureLimit } from "@/lib/features";

type FeatureAccessContextValue = {
  accessMap: FeatureAccessMap;
  isSuperAdmin: boolean;
  isLoading: boolean;
  /** True if the user has access to the given feature */
  can: (feature: FeatureId) => boolean;
  /** Returns the numeric limit, or Infinity if unlimited, or 0 if no access */
  limit: (feature: FeatureId, limitKey: string) => number;
};

const FeatureAccessContext = createContext<FeatureAccessContextValue>({
  accessMap:    {},
  isSuperAdmin: false,
  isLoading:    true,
  can:          () => false,
  limit:        () => 0,
});

export function FeatureAccessProvider({ children }: { children: React.ReactNode }) {
  const [accessMap, setAccessMap] = useState<FeatureAccessMap>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/features/access")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setAccessMap(json.data);
          setIsSuperAdmin(json.data.admin_panel?.source === "super_admin");
        }
      })
      .catch(() => {/* silently ignore — defaults to no access */})
      .finally(() => setIsLoading(false));
  }, []);

  const value: FeatureAccessContextValue = {
    accessMap,
    isSuperAdmin,
    isLoading,
    can:   (feature) => hasFeature(accessMap, feature),
    limit: (feature, limitKey) => getFeatureLimit(accessMap, feature, limitKey),
  };

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

export function useFeatureAccess(): FeatureAccessContextValue {
  return useContext(FeatureAccessContext);
}
