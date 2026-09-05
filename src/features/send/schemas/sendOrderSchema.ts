import { z } from 'zod';

export const sendOrderFormSchema = z.object({
  // Pickup / Sender info
  senderName: z.string().trim().min(2, 'Sender name is required'),
  senderPhone: z
    .string()
    .trim()
    .min(7, 'Valid phone number is required')
    .regex(/^[+0-9\s-]{7,20}$/, 'Please enter a valid phone number'),
  pickupAddress: z.string().trim().min(5, 'Pickup address is required'),
  pickupLat: z.number().nullable().optional(),
  pickupLng: z.number().nullable().optional(),
  pickupDirections: z.string().trim().optional(),
  savePickupAddress: z.boolean().default(false),
  pickupAddressLabel: z.string().trim().optional(),

  // Drop-off / Recipient info
  dropoffRecipientName: z.string().trim().min(2, 'Recipient name is required'),
  dropoffRecipientPhone: z
    .string()
    .trim()
    .min(7, 'Valid recipient phone is required')
    .regex(/^[+0-9\s-]{7,20}$/, 'Please enter a valid phone number'),
  dropoffAddress: z.string().trim().min(5, 'Drop-off address is required'),
  dropoffLat: z.number().nullable().optional(),
  dropoffLng: z.number().nullable().optional(),
  dropoffDirections: z.string().trim().optional(),
  saveDropoffAddress: z.boolean().default(false),
  dropoffAddressLabel: z.string().trim().optional(),

  // Package details
  weightKg: z
    .number({ invalid_type_error: 'Weight is required' })
    .positive('Weight must be greater than 0')
    .max(100, 'Weight exceeds maximum limit (100 kg)'),
  packageContents: z.string().trim().min(2, 'Please specify package contents'),
  isFragile: z.boolean().default(false),
  declaredValue: z.number().nonnegative().optional(),
});

export const strictSendOrderSchema = sendOrderFormSchema.extend({
  pickupLat: z.number({ required_error: 'Pickup latitude is compulsory' }),
  pickupLng: z.number({ required_error: 'Pickup longitude is compulsory' }),
  dropoffLat: z.number({ required_error: 'Drop-off latitude is compulsory' }),
  dropoffLng: z.number({ required_error: 'Drop-off longitude is compulsory' }),
});

export type SendOrderFormData = z.infer<typeof sendOrderFormSchema>;
export type StrictSendOrderFormData = z.infer<typeof strictSendOrderSchema>;
