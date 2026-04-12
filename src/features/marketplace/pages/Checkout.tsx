import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useCart } from "@/features/marketplace/context/CartContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShoppingBag,
} from "lucide-react";
import { usePaystackInline } from "@/features/marketplace/hooks/usePaystackInline";

import { AnimatePresence } from "framer-motion";
import { CheckoutProgress } from "@/features/marketplace/components/v2/CheckoutProgress";
import { DeliveryStep } from "@/features/marketplace/components/v2/DeliveryStep";
import { PaymentStep } from "@/features/marketplace/components/v2/PaymentStep";
import { SuccessStep } from "@/features/marketplace/components/v2/SuccessStep";
import { CrossZoneWarning } from "@/features/marketplace/components/v2/CrossZoneWarning";

const DELIVERY_FEE = 1500;

type PaymentInfo = {
  payment_method?: string | null;
  payment_ref?: string | null;
  payment_status?: string | null;
};

export default function Checkout() {
  const { user, profile, getToken, loading: authLoading } = useAuth();
  const { cartItems, clearCart } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pay } = usePaystackInline();

  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState({
    name: "",
    address: "",
    city_id: "",
    city_name: "Abuja",
    zone_id: "",
    zone_name: "",
    phone: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPaystackProcessing, setIsPaystackProcessing] = useState(false);
  const [showCrossZoneWarning, setShowCrossZoneWarning] = useState(false);

  const productTotal = cartItems.reduce(
    (sum, item: any) => sum + (item.products?.price ?? 0) * item.quantity,
    0
  );

  // Fetch available cities
  const { data: cities = [], isPending: isCitiesPending } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cities")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Fetch zones for selected city
  const { data: zones = [] } = useQuery({
    queryKey: ["zones", shipping.city_id],
    queryFn: async () => {
      if (!shipping.city_id) return [];
      const { data, error } = await (supabase as any)
        .from("delivery_zones")
        .select("*")
        .eq("city_id", shipping.city_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!shipping.city_id,
  });

  // Fetch dynamic delivery fee from config
  const { data: feeConfigs = [] } = useQuery({
    queryKey: ["fee-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fee_config")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Auto-select from localStorage, profile, or default to Abuja
  useEffect(() => {
    // Wait for basic data to load
    if (authLoading || isCitiesPending) return;

    // Prevent overwriting if user has already started typing or if data is already set
    if (shipping.city_id || shipping.address) return;

    // Priority 1: localStorage (Device-specific memory)
    const savedAddress = localStorage.getItem("linkup_last_shipping_address");
    if (savedAddress) {
      try {
        const parsed = JSON.parse(savedAddress);
        if (parsed && typeof parsed === "object") {
          setShipping((prev) => ({
            ...prev,
            ...parsed
          }));
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved address from localStorage", e);
      }
    }

    // Priority 2: User Profile (Account-wide master address)
    if (profile?.address || profile?.city_id) {
      setShipping((prev) => ({
        ...prev,
        name: profile.display_name || prev.name,
        address: profile.address || prev.address,
        city_id: profile.city_id || prev.city_id,
        zone_id: profile.zone_id || prev.zone_id,
        phone: profile.phone || prev.phone,
      }));
      return;
    }

    // Priority 3: Default to Abuja if no other source
    const abujaCity = cities.find((c: any) => c.name === "Abuja");
    if (abujaCity && !shipping.city_id) {
      setShipping((prev) => ({
        ...prev,
        city_id: abujaCity.id,
        city_name: abujaCity.name,
      }));
    }
  }, [cities, profile, authLoading, isCitiesPending, shipping.city_id, shipping.address]);

  // Calculate multi-shipment delivery fee
  const uniqueSellerIds = new Set(cartItems.map((item: any) => item.products?.seller_id).filter(Boolean));
  const sellerCount = Math.max(1, uniqueSellerIds.size);

  const riderFeeConfig = feeConfigs.find((f: any) => f.fee_type === "rider");
  const dynamicDefaultFee = riderFeeConfig?.flat_fee ?? DELIVERY_FEE;

  // Cross-Zone Fee Calculation
  const crossZoneFeeConfig = feeConfigs.find((f: any) => f.fee_type === "buyer_cross_zone");
  const baseCrossZoneFee = crossZoneFeeConfig?.flat_fee ?? 0;
  
  // Count how many sellers are in a different zone from the shipping zone
  const crossZoneSellerCount = Array.from(uniqueSellerIds).filter(sId => {
    const sellerItem = cartItems.find((item: any) => item.products?.seller_id === sId);
    const sellerZoneId = sellerItem?.products?.zone_id;
    return sellerZoneId && shipping.zone_id && sellerZoneId !== shipping.zone_id;
  }).length;

  const crossZoneFee = baseCrossZoneFee * crossZoneSellerCount;

  const selectedZone = zones.find((z: any) => z.id === shipping.zone_id);
  const zoneFee = selectedZone?.delivery_fee;
  const baseDeliveryFee = (zoneFee === 1500 || zoneFee === null || zoneFee === undefined)
    ? (shipping.zone_id ? dynamicDefaultFee : 0)
    : zoneFee;
  const deliveryFee = baseDeliveryFee * sellerCount;
  const grandTotal = productTotal + deliveryFee + crossZoneFee;

  const placeOrder = useMutation({
    mutationFn: async (paymentInfo?: PaymentInfo) => {
      const token = await getToken();
      if (!user || !profile?.onboarding_completed || !token) {
        throw new Error("Please log in and finish setting up your account to continue.");
      }

      const orderData = {
        items: cartItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          size: item.size,
          price: item.products?.price,
          seller_id: item.products?.seller_id,
          title: item.products?.title,
          image: item.products?.images?.[0] || ""
        })),
        shipping_address: shipping,
        total: grandTotal,
        delivery_fee: deliveryFee,
        cross_zone_fee: crossZoneFee,
        payment_method: paymentInfo?.payment_method ?? "direct",
        payment_ref: paymentInfo?.payment_ref ?? null,
        payment_status: paymentInfo?.payment_status ?? null,
        zone_id: shipping.zone_id,
        city_id: shipping.city_id,
        delivery_lat: shipping.lat,
        delivery_lng: shipping.lng,
      };

      const { data, error } = await supabase.functions.invoke("create-order", {
        body: orderData,
      });

      if (error) throw new Error(error.message || "We couldn't create your order. Please try again.");

      const summary = {
        items: orderData.items,
        total: grandTotal,
        orderNumber: data?.order_ids?.length > 1
          ? `${data.order_ids.length} Shipments`
          : `#ORD-${(data?.main_order_id || "NEW").slice(0, 8).toUpperCase()}`,
        orderIds: data?.order_ids || [],
        date: new Date().toLocaleString(),
      };

      await clearCart();
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      return summary;
    },
    onSuccess: (summary) => {
      setOrderSummary(summary);
      setStep(3);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handlePayAndPlaceOrder = async () => {
    if (!user || !profile?.onboarding_completed) {
      toast.error("Please log in and finish your profile setup to continue");
      return;
    }

    const email = user.email;
    if (!email) {
      toast.error("We couldn't find an email for your account");
      return;
    }

    const orderData = {
      items: cartItems.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        size: item.size,
        price: item.products?.price,
        seller_id: item.products?.seller_id,
        title: item.products?.title,
        image: item.products?.images?.[0] || ""
      })),
      shipping_address: shipping,
      total: grandTotal,
      delivery_fee: deliveryFee,
      cross_zone_fee: crossZoneFee,
      zone_id: shipping.zone_id,
      city_id: shipping.city_id,
    };

    setIsPaystackProcessing(true);
    try {
      // Save shipping details for future checkout sessions on this device
      localStorage.setItem("linkup_last_shipping_address", JSON.stringify(shipping));

      const { data: pkData } = await supabase.functions.invoke("paystack-public-key");
      const publicKey = (pkData as any)?.publicKey;
      if (!publicKey) throw new Error("The payment system is currently unavailable. Please try later.");

      const paid = await pay({
        publicKey,
        email,
        amountKobo: Math.round(grandTotal * 100),
        reference: `LKUP_${Date.now()}`,
        metadata: {
          order_details: orderData
        }
      });

      await placeOrder.mutateAsync({
        payment_method: "direct",
        payment_status: "paid",
        payment_ref: paid.reference,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Payment failed");
    } finally {
      setIsPaystackProcessing(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        setShipping((prev) => ({
          ...prev,
          address: data.display_name,
          lat: latitude,
          lng: longitude
        }));
        toast.success("Location updated successfully");
      } catch {
        toast.error("We couldn't find your address. Please enter it manually.");
      } finally {
        setIsDetecting(false);
      }
    });
  };

  const hasCrossZoneItems = cartItems.some(
    (item: any) => item.products?.zone_id && item.products.zone_id !== shipping.zone_id
  );

  const handleStep1Next = () => {
    if (hasCrossZoneItems) {
      setShowCrossZoneWarning(true);
    } else {
      setStep(2);
    }
  };

  if (cartItems.length === 0 && step < 3) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <ShoppingBag className="text-muted-foreground" size={32} />
          </div>
          <h2 className="text-xl font-bold">Your cart is empty</h2>
          <Button onClick={() => navigate("/")}>Go Shopping</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto pb-20">
        <CheckoutProgress currentStep={step} />

        <div className="px-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <DeliveryStep
                key="step1"
                shipping={shipping}
                setShipping={setShipping}
                cities={cities}
                zones={zones}
                onNext={handleStep1Next}
                isDetecting={isDetecting}
                onDetectLocation={handleDetectLocation}
              />
            )}

            {step === 2 && (
              <PaymentStep
                key="step2"
                items={cartItems.map(i => ({
                  title: i.products?.title,
                  price: i.products?.price,
                  quantity: i.quantity,
                  size: i.size,
                  image: i.products?.images?.[0]
                }))}
                productTotal={productTotal}
                deliveryFee={deliveryFee}
                crossZoneFee={crossZoneFee}
                grandTotal={grandTotal}
                sellerCount={sellerCount}
                onBack={() => setStep(1)}
                onPay={handlePayAndPlaceOrder}
                isPending={placeOrder.isPending || isPaystackProcessing}
              />
            )}

            {step === 3 && (
              <SuccessStep
                key="step3"
                orderSummary={orderSummary}
                onClose={() => navigate("/orders")}
              />
            )}
          </AnimatePresence>
        </div>

        <CrossZoneWarning 
          open={showCrossZoneWarning}
          onOpenChange={setShowCrossZoneWarning}
          onConfirm={() => {
            setShowCrossZoneWarning(false);
            setStep(2);
          }}
        />
      </div>
    </AppLayout>
  );
}
