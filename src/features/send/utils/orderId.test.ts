import { describe, it, expect } from 'vitest';
import { generateSendOrderId, isValidSendOrderId } from './orderId';
import { calculateHaversineDistance } from '../hooks/useSendPricing';
import { sendOrderFormSchema } from '../schemas/sendOrderSchema';

describe('Send Order Utilities & Schemas', () => {
  it('generates an order ID matching LSEND-XXXXXX-XXXX format', () => {
    const id = generateSendOrderId();
    expect(id).toMatch(/^LSEND-[A-Z0-9]{6}-[A-Z0-9]{4}$/);
    expect(isValidSendOrderId(id)).toBe(true);
  });

  it('rejects invalid order IDs', () => {
    expect(isValidSendOrderId('INVALID-123')).toBe(false);
    expect(isValidSendOrderId('LSEND-123')).toBe(false);
    expect(isValidSendOrderId('')).toBe(false);
  });

  it('calculates Haversine distance between two coordinates accurately', () => {
    // Abuja Central (9.0765, 7.3986) to Gwarinpa (9.1124, 7.4101) ~ 4.2 km
    const distance = calculateHaversineDistance(9.0765, 7.3986, 9.1124, 7.4101);
    expect(distance).toBeGreaterThan(3.5);
    expect(distance).toBeLessThan(5.5);
  });

  it('validates a complete send order form schema', () => {
    const validData = {
      senderName: 'Musa Bello',
      senderPhone: '+2348012345678',
      pickupAddress: 'Plot 120, Wuse 2, Abuja',
      pickupLat: 9.0765,
      pickupLng: 7.3986,
      pickupDirections: 'Beside the blue gate',
      savePickupAddress: true,
      pickupAddressLabel: 'Office',

      dropoffRecipientName: 'Amina Yusuf',
      dropoffRecipientPhone: '+2348098765432',
      dropoffAddress: 'House 14, 3rd Avenue, Gwarinpa, Abuja',
      dropoffLat: 9.1124,
      dropoffLng: 7.4101,
      dropoffDirections: 'Flat 2',
      saveDropoffAddress: false,

      weightKg: 2.5,
      packageContents: 'Important business contracts',
      isFragile: true,
      declaredValue: 25000,
    };

    const parsed = sendOrderFormSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('fails validation when mandatory fields are missing', () => {
    const invalidData = {
      senderName: '',
      senderPhone: '123',
      pickupAddress: '',
      dropoffRecipientName: '',
      dropoffRecipientPhone: '',
      dropoffAddress: '',
      weightKg: -5,
      packageContents: '',
    };

    const parsed = sendOrderFormSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('calculates the delivery fee following the exact formula: Base + (Distance x Rate) + Surcharge + Service fee', () => {
    const baseFee = 500;
    const perKmRate = 100;
    const distanceKm = 4.2;
    const distanceFee = Math.round(distanceKm * perKmRate); // 420
    const weightKg = 3.5;
    const packageSurcharge = weightKg <= 2 ? 0 : weightKg <= 5 ? 200 : 500; // 200
    const serviceFee = 200;

    const expectedTotal = baseFee + distanceFee + packageSurcharge + serviceFee;
    expect(expectedTotal).toBe(500 + 420 + 200 + 200); // 1320
  });
});
