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
    
    const sellerProfile = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
    const orderDetails = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const orderSeller = orderDetails?.seller;
    
    // Use shipment.seller or order.seller
    const s = sellerProfile || orderSeller;
    
    // Priority 1: Direct shipment pickup address
    const shipmentPickup = ensureAddressString(shipment.pickup_address);
    if (shipmentPickup) return shipmentPickup;
    
    // Priority 2: Order-level pickup address (newly added JSONB column)
    const orderPickup = ensureAddressString(orderDetails?.pickup_address);
    if (orderPickup) return orderPickup;

    // Priority 3: Seller's profile address
    const sellerAddr = ensureAddressString(s?.address);
    if (sellerAddr) return sellerAddr;

    // Priority 4: Old legacy fallback in shipping_info
    const legacyPickup = ensureAddressString(orderDetails?.shipping_info?.pickup_address);
    if (legacyPickup) return legacyPickup;

    return "Pickup Point";
};

export const getDeliveryAddress = (shipment: any) => {
    if (!shipment) return "Drop-off Node";
    
    const orderDetails = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const deliveryData = orderDetails?.shipping_info || shipment.delivery_address || {};
    
    const addr = ensureAddressString(deliveryData);
    return addr || "Drop-off Node";
};

export const getBuyerContact = (shipment: any) => {
    if (!shipment?.order) return { name: "Customer", phone: "No phone" };
    
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const shippingInfo = order?.shipping_info || {};
    const buyerProfile = order?.buyer || {};
    
    return {
        name: ensureAddressString(buyerProfile.full_name) || 
              ensureAddressString(buyerProfile.display_name) || 
              (shippingInfo as any)?.name || 
              "Customer",
        phone: buyerProfile.phone || (shippingInfo as any)?.phone || "No phone"
    };
};

export const getSellerInfo = (shipment: any) => {
    const sellerProfile = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
    const orderDetails = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const orderSeller = orderDetails?.seller;
    const s = sellerProfile || orderSeller;
    
    return {
        name: s?.display_name || s?.business_name || "Seller",
        phone: s?.phone || "No phone provided"
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
    let lat, lng, address;

    if (mode === 'pickup') {
        const sellerProfile = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
        const orderDetails = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
        const orderSeller = orderDetails?.seller;
        const s = sellerProfile || orderSeller;
        
        const orderPickup = orderDetails?.pickup_address;
        
        lat = shipment.pickup_latitude || 
              (orderPickup as any)?.lat || 
              orderDetails?.pickup_lat || 
              s?.latitude;
              
        lng = shipment.pickup_longitude || 
              (orderPickup as any)?.lng || 
              orderDetails?.pickup_lng || 
              s?.longitude;
              
        address = getPickupAddress(shipment);
    } else {
        const o = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
        const deliveryData = o?.shipping_info || shipment.delivery_address || {};
        
        address = getDeliveryAddress(shipment);
        lat = (deliveryData as any)?.lat || shipment.buyer_latitude;
        lng = (deliveryData as any)?.lng || shipment.buyer_longitude;
    }
    
    return lat && lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : address && address !== "Pickup Point" && address !== "Drop-off Node"
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : "";
};
