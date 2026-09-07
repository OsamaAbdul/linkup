/**
 * Shared utility functions for Logistics features
 */

/**
 * Safely extracts a display string from various address formats (string, JSONB object)
 */
export const ensureAddressString = (val: any): string | null => {
    if (!val) return null;
    
    // If it's a simple string, return it if not empty
    if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    
    // If it's a JSONB object, look for 'address' or 'name' fields
    if (typeof val === 'object') {
        const addr = val.address || val.display_address || val.full_address || val.name;
        if (typeof addr === 'string') {
            const trimmed = addr.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
    }
    
    return null;
};

export const getPickupAddress = (shipment: any) => {
    if (!shipment) return "Pickup Point";
    
    // Priority 1: Send Order / Normalized direct pickup address
    const directPickup = ensureAddressString(
        shipment.pickup_address ||
        shipment.pickup_address_text ||
        shipment.origin_address
    );
    if (directPickup) return directPickup;
    
    // Priority 2: Seller's profile address (Marketplace shipments)
    const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : (shipment.seller || shipment.order?.seller);
    const sellerAddr = ensureAddressString(seller?.address);
    if (sellerAddr) return sellerAddr;

    // Priority 3: Order nested pickup address
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const orderPickup = ensureAddressString(order?.pickup_address || order?.pickup_address_text);
    if (orderPickup) return orderPickup;

    return "Pickup Point";
};

export const getDeliveryAddress = (shipment: any) => {
    if (!shipment) return "Drop-off Node";
    
    // Priority 1: Send Order direct dropoff fields
    const directDropoff = ensureAddressString(
        shipment.dropoff_address ||
        shipment.delivery_address ||
        shipment.delivery_address_text ||
        shipment.destination_address
    );
    if (directDropoff) return directDropoff;
    
    // Priority 2: order_recipient relation (Marketplace Orders)
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const recipient = order?.order_recipient?.[0] || order?.order_recipient;
    const recipientAddr = ensureAddressString(recipient?.address_line || recipient?.address);
    if (recipientAddr) return recipientAddr;

    // Priority 3: Order direct dropoff/shipping address
    const orderDropoff = ensureAddressString(
        order?.dropoff_address ||
        order?.delivery_address ||
        order?.delivery_address_text ||
        order?.shipping_address
    );
    if (orderDropoff) return orderDropoff;

    // Priority 4: Buyer profile address (Legacy fallback)
    const buyer = order?.buyer || (order?.profiles && !Array.isArray(order.profiles) ? order.profiles : null) || shipment.buyer;
    const buyerAddr = ensureAddressString(buyer?.address);
    if (buyerAddr) return buyerAddr;

    return "Drop-off Node";
};

export const getBuyerContact = (shipment: any) => {
    if (!shipment) return { name: "Customer", phone: "No phone" };
    
    // Send order direct recipient
    if (shipment.is_send_order || shipment.dropoff_recipient_name || shipment.recipient_name) {
        return {
            name: shipment.dropoff_recipient_name || shipment.recipient_name || shipment.buyer?.name || "Customer",
            phone: shipment.dropoff_recipient_phone || shipment.recipient_phone || shipment.buyer?.phone || "No phone"
        };
    }

    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const recipient = order?.order_recipient?.[0] || order?.order_recipient || {};
    const buyerProfile = order?.buyer || (order?.profiles && !Array.isArray(order.profiles) ? order.profiles : null) || shipment.buyer || {};
    
    return {
        name: recipient.full_name || 
              ensureAddressString(buyerProfile.full_name) || 
              ensureAddressString(buyerProfile.display_name) || 
              "Customer",
        phone: recipient.phone || buyerProfile.phone || "No phone"
    };
};

export const getSellerInfo = (shipment: any) => {
    if (!shipment) return { name: "Seller", phone: "No phone" };

    // Send order direct sender
    if (shipment.is_send_order || shipment.sender_name) {
        return {
            name: shipment.sender_name || shipment.seller?.name || "Sender",
            phone: shipment.sender_phone || shipment.seller?.phone || "No phone provided"
        };
    }

    const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
    const orderSeller = shipment.order?.seller;
    const activeSeller = seller || orderSeller;
    
    return {
        name: activeSeller?.display_name || activeSeller?.business_name || "Seller",
        phone: activeSeller?.phone || "No phone provided"
    };
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const generateMapsUrl = (shipment: any, mode: 'pickup' | 'delivery' = 'delivery') => {
    if (!shipment) return "";
    let lat, lng, address;

    if (mode === 'pickup') {
        const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : (shipment.seller || shipment.order?.seller);
        
        // Use standardized columns and Send Order coordinate fields
        lat = shipment.pickup_lat || seller?.latitude || seller?.lat;
        lng = shipment.pickup_lng || seller?.longitude || seller?.lng;
        address = getPickupAddress(shipment);
    } else {
        const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
        const recipient = order?.order_recipient?.[0] || order?.order_recipient;
        const buyer = order?.buyer || shipment.buyer;
        
        // Use standardized columns, Send Order dropoff fields, or recipient coordinates
        lat = shipment.delivery_lat || shipment.dropoff_lat || recipient?.lat || recipient?.latitude || buyer?.latitude || buyer?.lat;
        lng = shipment.delivery_lng || shipment.dropoff_lng || recipient?.lng || recipient?.longitude || buyer?.longitude || buyer?.lng;
        address = getDeliveryAddress(shipment);
    }
    
    return lat && lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : address && address !== "Pickup Point" && address !== "Drop-off Node"
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : "";
};

/**
 * Computes the rider's take-home earnings cut for a mission (SEND packages & marketplace shipments)
 * strictly hiding the customer's total fee and showing only the rider's payout according to fee configuration.
 */
export const calculateRiderEarnings = (
    shipment: any,
    feeConfig?: { payoutRate?: number; minPayout?: number }
): number => {
    if (!shipment) return 0;

    const payoutRate = feeConfig?.payoutRate ?? 0.80; // default 80%
    const minPayout = feeConfig?.minPayout ?? 1000;    // default ₦1,000

    const isSendOrder =
        shipment.is_send_order ||
        String(shipment.id || '').startsWith('LSEND') ||
        String(shipment.order_id || '').startsWith('LSEND');

    // 1. If explicit rider_earnings is already stored/provided on shipment
    if (typeof shipment.rider_earnings === 'number' && shipment.rider_earnings > 0) {
        return Math.round(shipment.rider_earnings);
    }

    // 2. If it's a SEND package order, inspect package_details for pre-calculated pricing breakdown
    if (isSendOrder) {
        let pkg = shipment.package_details;
        if (typeof pkg === 'string') {
            try { pkg = JSON.parse(pkg); } catch { pkg = {}; }
        }
        const breakdownEarnings = pkg?.pricing_breakdown?.riderEarnings ?? pkg?.pricing_breakdown?.rider_earnings;
        if (typeof breakdownEarnings === 'number' && breakdownEarnings > 0) {
            return Math.round(breakdownEarnings);
        }

        // Compute cut according to SEND fee configuration
        const totalFee = Number(shipment.delivery_fee || 1500);
        return Math.max(minPayout, Math.round(totalFee * payoutRate));
    }

    // 3. For marketplace shipments: inspect rider_fee_breakdown
    if (shipment.rider_fee_breakdown) {
        let breakdown = shipment.rider_fee_breakdown;
        if (typeof breakdown === 'string') {
            try { breakdown = JSON.parse(breakdown); } catch { breakdown = {}; }
        }
        if (typeof breakdown.total === 'number' && breakdown.total > 0) {
            return Math.round(breakdown.total);
        }
    }

    // Fallback for regular shipment delivery fee
    const deliveryFee = Number(shipment.delivery_fee || shipment.order?.shipping_fee || 0);
    return Math.round(deliveryFee);
};
