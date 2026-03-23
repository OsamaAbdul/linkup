import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useCart } from "@/features/commerce/context/CartContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  LocateFixed,
  Loader2,
  Navigation,
  Truck,
  CreditCard,
  ShieldCheck,
  Lock,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Receipt from "@/features/commerce/components/Receipt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { usePaystackInline } from "@/features/commerce/hooks/usePaystackInline";

import { AnimatePresence } from "framer-motion";
import { CheckoutProgress } from "@/features/commerce/components/v2/CheckoutProgress";
import { DeliveryStep } from "@/features/commerce/components/v2/DeliveryStep";
import { PaymentStep } from "@/features/commerce/components/v2/PaymentStep";
import { SuccessStep } from "@/features/commerce/components/v2/SuccessStep";

const DELIVERY_FEE = 1500; 

type PlaceOrderVars = {
  payment_method?: string | null;
  payment_ref?: string | null;
  payment_status?: string | null;
};

export default function Checkout() {
  const { user, profile, getToken } = useAuth();
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

  const productTotal = cartItems.reduce(
    (sum, item: any) => sum + (item.products?.price ?? 0) * item.quantity,
    0
  );

  // Fetch available cities
  const { data: cities = [] } = useQuery({
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

  // Auto-select Abuja on load if available
  useEffect(() => {
    const abujaCity = cities.find((c: any) => c.name === "Abuja");
    if (abujaCity && !shipping.city_id) {
      setShipping((prev) => ({
        ...prev,
        city_id: abujaCity.id,
        city_name: abujaCity.name,
      }));
    }
  }, [cities, shipping.city_id]);

  // Calculate delivery fee
  const selectedZone = zones.find((z: any) => z.id === shipping.zone_id);
  const deliveryFee = selectedZone?.delivery_fee ?? (shipping.zone_id ? DELIVERY_FEE : 0);
  const grandTotal = productTotal + deliveryFee;

  const placeOrder = useMutation({
    mutationFn: async (vars?: PlaceOrderVars) => {
      const token = await getToken();
      if (!user || !profile?.onboarding_completed || !token) {
        throw new Error("Authentication or profile incomplete. Please login again.");
      }

      const payload = {
        items: cartItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.products?.price,
          seller_id: item.products?.seller_id,
          title: item.products?.title,
          image: item.products?.images?.[0] || ""
        })),
        shipping_address: shipping,
        total: grandTotal,
        delivery_fee: deliveryFee,
        payment_method: vars?.payment_method ?? "direct",
        payment_ref: vars?.payment_ref ?? null,
        payment_status: vars?.payment_status ?? null,
        zone_id: shipping.zone_id,
        city_id: shipping.city_id,
        delivery_lat: shipping.lat,
        delivery_lng: shipping.lng,
      };

      const { data, error } = await supabase.functions.invoke("create-order", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Order creation failed");

      const summary = {
        items: payload.items,
        total: grandTotal,
        orderNumber: `#ORD-${Math.floor(Math.random() * 1000000)}`,
        date: new Date().toLocaleString(),
      };

      await clearCart();
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      return summary;
    },
    onSuccess: (data) => {
      setOrderSummary(data);
      setStep(3);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handlePayAndPlaceOrder = async () => {
    if (!user || !profile?.onboarding_completed) {
      toast.error("Please login and complete onboarding to continue");
      return;
    }

    const email = user.email;
    if (!email) {
      toast.error("Account email is missing");
      return;
    }

    const payload = {
      items: cartItems.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products?.price,
        seller_id: item.products?.seller_id,
        title: item.products?.title,
        image: item.products?.images?.[0] || ""
      })),
      shipping_address: shipping,
      total: grandTotal,
      delivery_fee: deliveryFee,
      zone_id: shipping.zone_id,
      city_id: shipping.city_id,
    };

    setIsPaystackProcessing(true);
    try {
      const { data: pkData } = await supabase.functions.invoke("paystack-public-key");
      const publicKey = (pkData as any)?.publicKey;
      if (!publicKey) throw new Error("Payment gateway offline");

      const paid = await pay({
        publicKey,
        email,
        amountKobo: Math.round(grandTotal * 100),
        reference: `LKUP_${Date.now()}`,
        metadata: {
          order_payload: payload
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
        toast.success("Location and address synchronized");
      } catch {
        toast.error("Could not resolve address details");
      } finally {
        setIsDetecting(false);
      }
    });
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
                onNext={() => setStep(2)}
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
                    image: i.products?.images?.[0]
                }))}
                productTotal={productTotal}
                deliveryFee={deliveryFee}
                grandTotal={grandTotal}
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
      </div>
    </AppLayout>
  );
}
