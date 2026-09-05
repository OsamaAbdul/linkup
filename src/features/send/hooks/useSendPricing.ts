import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoadRoute } from './useRoadRoute';

export interface PricingInput {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  weightKg: number;
  isFragile?: boolean;
}


export interface SendFeeBreakdown {
  baseFee: number;
  perKmRate: number;
  distanceKm: number;
  distanceFee: number;
  packageSurcharge: number;
  serviceFee: number;
  fragileSurcharge: number;
  totalFee: number;
  riderEarnings?: number;
  platformFee?: number;
  currency: string;
  estimatedMinutesRange: string;
  estimatedPickupWindow: string;
  isBackendVerified: boolean;
}

// Haversine distance calculator in KM
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0;
  if (lat1 === lat2 && lon1 === lon2) return 1.0;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(R * c * 10) / 10);
}

export function useSendPricing({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  weightKg,
  isFragile = false,
}: PricingInput): SendFeeBreakdown {
  // Query real road network route from OSRM
  const { data: roadData } = useRoadRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // Query backend calculation RPC
  const { data: rpcData } = useQuery({
    queryKey: [
      'calculate_send_delivery_fee',
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      weightKg,
      isFragile,
    ],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any).rpc('calculate_send_delivery_fee', {
          p_pickup_lat: pickupLat || null,
          p_pickup_lng: pickupLng || null,
          p_dropoff_lat: dropoffLat || null,
          p_dropoff_lng: dropoffLng || null,
          p_weight_kg: weightKg || 1.0,
          p_is_fragile: isFragile,
        });
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('Backend fee calculation fallback:', err);
        return null;
      }
    },
    staleTime: 60000,
  });

  return useMemo(() => {
    // 1. Determine distance: prioritize road network calculation
    let distanceKm = roadData?.distanceKm;
    if (typeof distanceKm !== 'number') {
      if (rpcData && typeof rpcData.distance_km === 'number') {
        distanceKm = Number(rpcData.distance_km);
      } else if (
        typeof pickupLat === 'number' &&
        typeof pickupLng === 'number' &&
        typeof dropoffLat === 'number' &&
        typeof dropoffLng === 'number'
      ) {
        distanceKm = calculateHaversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      } else {
        distanceKm = 5.0;
      }
    }

    const baseFee = rpcData?.base_fee ? Number(rpcData.base_fee) : 500;
    const perKmRate = rpcData?.per_km_rate ? Number(rpcData.per_km_rate) : 100;
    const distanceFee = Math.round(distanceKm * perKmRate);

    let packageSurcharge = 0;
    if (weightKg <= 2) {
      packageSurcharge = 0;
    } else if (weightKg <= 5) {
      packageSurcharge = 200;
    } else if (weightKg <= 10) {
      packageSurcharge = 500;
    } else {
      packageSurcharge = 1000;
    }

    const serviceFee = rpcData?.service_fee ? Number(rpcData.service_fee) : 200;
    const fragileSurcharge = isFragile ? (rpcData?.fragile_surcharge ? Number(rpcData.fragile_surcharge) : 300) : 0;
    const totalFee = baseFee + distanceFee + packageSurcharge + serviceFee + fragileSurcharge;

    const estimatedMinutesRange = roadData?.estimatedMinutesRange || `${Math.round(15 + distanceKm * 2.5)} - ${Math.round(35 + distanceKm * 2.5)} mins`;

    return {
      baseFee,
      perKmRate,
      distanceKm,
      distanceFee,
      packageSurcharge,
      serviceFee,
      fragileSurcharge,
      totalFee,
      riderEarnings: Math.round(totalFee * 0.8),
      platformFee: Math.round(totalFee * 0.2),
      currency: 'NGN',
      estimatedMinutesRange,
      estimatedPickupWindow: '10 - 20 mins',
      isBackendVerified: Boolean(rpcData && typeof rpcData.total_fee === 'number'),
    };
  }, [roadData, rpcData, pickupLat, pickupLng, dropoffLat, dropoffLng, weightKg, isFragile]);
}

