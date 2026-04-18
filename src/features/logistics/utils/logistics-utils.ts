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
    
    // Priority 1: New Normalized Flat Column (shipments)
    if (shipment.pickup_address_text) return shipment.pickup_address_text;
    
    // Priority 2: Seller's profile address (Legacy fallback)
    const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
    const sellerAddr = ensureAddressString(seller?.address);
    if (sellerAddr) return sellerAddr;

    return "Pickup Point";
};

export const getDeliveryAddress = (shipment: any) => {
    if (!shipment) return "Drop-off Node";
    
    // Priority 1: New Normalized Flat Column (shipments)
    if (shipment.delivery_address_text) return shipment.delivery_address_text;
    
    // Priority 2: order_recipient relation (Core Source of Truth)
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const recipient = order?.order_recipient?.[0] || order?.order_recipient;
    if (recipient?.address_line) return recipient.address_line;

    return "Drop-off Node";
};

export const getBuyerContact = (shipment: any) => {
    if (!shipment?.order) return { name: "Customer", phone: "No phone" };
    
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const recipient = order?.order_recipient?.[0] || order?.order_recipient || {};
    const buyerProfile = order?.buyer || (order?.profiles && !Array.isArray(order.profiles) ? order.profiles : null) || {};
    
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
        
        // Use standardized columns
        lat = shipment.pickup_lat || seller?.latitude;
        lng = shipment.pickup_lng || seller?.longitude;
        address = getPickupAddress(shipment);
    } else {
        const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
        const recipient = order?.order_recipient?.[0] || order?.order_recipient;
        
        // Use standardized columns
        lat = shipment.delivery_lat || recipient?.lat || order?.buyer?.latitude;
        lng = shipment.delivery_lng || recipient?.lng || order?.buyer?.longitude;
        address = getDeliveryAddress(shipment);
    }
    
    return lat && lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : address && address !== "Pickup Point" && address !== "Drop-off Node"
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : "";
};
