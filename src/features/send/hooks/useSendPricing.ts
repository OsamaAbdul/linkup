import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  // Query backend calculation RPC (never trust frontend-only values)
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
    // If backend returned authoritative result, use it directly
    if (rpcData && typeof rpcData.total_fee === 'number') {
      const distanceKm = Number(rpcData.distance_km || 5.0);
      const minMinutes = Math.round(15 + distanceKm * 2.5);
      const maxMinutes = minMinutes + 20;

      return {
        baseFee: Number(rpcData.base_fee || 500),
        perKmRate: Number(rpcData.per_km_rate || 100),
        distanceKm,
        distanceFee: Number(rpcData.distance_fee || 500),
        packageSurcharge: Number(rpcData.package_surcharge || 0),
        serviceFee: Number(rpcData.service_fee || 200),
        fragileSurcharge: Number(rpcData.fragile_surcharge || 0),
        totalFee: Number(rpcData.total_fee),
        riderEarnings: typeof rpcData.rider_earnings === 'number' ? Number(rpcData.rider_earnings) : Math.round(Number(rpcData.total_fee) * 0.8),
        platformFee: typeof rpcData.platform_fee === 'number' ? Number(rpcData.platform_fee) : Math.round(Number(rpcData.total_fee) * 0.2),
        currency: 'NGN',
        estimatedMinutesRange: `${minMinutes} - ${maxMinutes} mins`,
        estimatedPickupWindow: '10 - 20 mins',
        isBackendVerified: true,
      };
    }

    // Default Fallback calculation matching formula:
    // Delivery fee = Base fee (500) + (Distance x Per-km rate 100) + Package surcharge + Optional service fees (200)
    let distanceKm = 5.0;
    if (
      typeof pickupLat === 'number' &&
      typeof pickupLng === 'number' &&
      typeof dropoffLat === 'number' &&
      typeof dropoffLng === 'number'
    ) {
      distanceKm = calculateHaversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    }

    const baseFee = 500;
    const perKmRate = 100;
    const distanceFee = Math.round(distanceKm * perKmRate);

    let packageSurcharge = 0;
    if (weightKg <= 2) {
      packageSurcharge = 0; // Small package: ₦0
    } else if (weightKg <= 5) {
      packageSurcharge = 200; // Medium package: ₦200
    } else if (weightKg <= 10) {
      packageSurcharge = 500; // Large package: ₦500
    } else {
      packageSurcharge = 1000; // Extra large package: ₦1,000
    }

    const serviceFee = 200;
    const fragileSurcharge = isFragile ? 300 : 0;
    const totalFee = baseFee + distanceFee + packageSurcharge + serviceFee + fragileSurcharge;

    const minMinutes = Math.round(15 + distanceKm * 2.5);
    const maxMinutes = minMinutes + 20;

    return {
      baseFee,
      perKmRate,
      distanceKm,
      distanceFee,
      packageSurcharge,
      serviceFee,
      fragileSurcharge,
      totalFee,
      currency: 'NGN',
      estimatedMinutesRange: `${minMinutes} - ${maxMinutes} mins`,
      estimatedPickupWindow: '10 - 20 mins',
      isBackendVerified: false,
    };
  }, [rpcData, pickupLat, pickupLng, dropoffLat, dropoffLng, weightKg, isFragile]);
}
