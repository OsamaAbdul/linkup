export type SendOrderStatus =
  | 'pending_payment'
  | 'finding_rider'
  | 'assigned_rider'
  | 'pickup'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface PackageDetails {
  weight_kg: number;
  contents: string;
  is_fragile: boolean;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  declared_value?: number;
}

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  type: 'pickup' | 'dropoff' | 'both';
  contact_name: string;
  contact_phone: string;
  address: string;
  directions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export interface SendOrder {
  id: string; // LSEND-XXXXXX-XXXX
  user_id: string;
  status: SendOrderStatus;
  sender_name: string;
  sender_phone: string;
  pickup_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_directions?: string | null;
  dropoff_recipient_name: string;
  dropoff_recipient_phone: string;
  dropoff_address: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  dropoff_directions?: string | null;
  package_details: PackageDetails;
  rider_id?: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
  rider_avatar?: string | null;
  rider_vehicle?: string | null;
  rider_lat?: number | null;
  rider_lng?: number | null;
  delivery_fee: number;
  currency: string;
  payment_status: string;
  payment_ref?: string | null;
  paid_at?: string | null;
  estimated_delivery_time?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}
