import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = 1000 * 60 * 60 * 24;

/**
 * Hook to fetch and cache marketplace categories.
 * Optimized with 1-hour staleTime and 24-hour retention.
 * Only fetches fields used by the UI (id, name, slug, icon).
 */
export const useCategories = () => {
  return useQuery({
    queryKey: ["marketplace-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });
};

/**
 * Hook to fetch and cache delivery zones.
 * Can fetch all zones or be filtered by cityId.
 * Optimized with 1-hour staleTime and 24-hour retention.
 * Only fetches fields used by the UI.
 */
export const useZones = (cityId?: string) => {
  return useQuery({
    queryKey: cityId ? ["marketplace-zones", cityId] : ["marketplace-zones-all"],
    queryFn: async () => {
      let query = supabase
        .from("delivery_zones")
        .select("id, name, city_id, is_active, cities:city_id(name)")
        .eq("is_active", true)
        .order("name");
      
      if (cityId) {
        query = query.eq("city_id", cityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });
};

/**
 * Hook to fetch and cache cities.
 * Only fetches fields used by the UI (id, name, is_active).
 */
export const useCities = () => {
  return useQuery({
    queryKey: ["marketplace-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });
};

