import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  LocateFixed,
  Loader2,
  Navigation,
  Truck,
  CreditCard,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Receipt from "@/components/checkout/Receipt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaystackInline } from "@/hooks/usePaystackInline";

const steps = ["Review", "Shipping", "Payment", "Done"];

const DELIVERY_FEE = 1500; // Flat ₦1,500 per delivery

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

  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState({
    name: "",
    address: "",
    city_id: "",
    city_name: "Abuja",
    zone_id: "",
    zone_name: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("direct"); // "direct" | "pod"
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
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

  // Calculate delivery fee based on selected zone, fallback to constant
  const selectedZone = zones.find((z: any) => z.id === shipping.zone_id);
  const deliveryFee = selectedZone?.delivery_fee ?? DELIVERY_FEE;
  const grandTotal = productTotal + deliveryFee;

  const placeOrder = useMutation({
    mutationFn: async (vars?: PlaceOrderVars) => {
      const token = await getToken();
      if (!user || !profile?.onboarding_completed || !token) {
        toast.error("Authentication or profile incomplete. Please login again.");
        return;
      }

      const effectivePaymentMethod = vars?.payment_method ?? paymentMethod;

      // Prepare payload
      const payload = {
        items: cartItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.products?.price,
          seller_id: item.products?.seller_id,
        })),
        shipping_address: shipping,
        pickup_address: null,
        total: grandTotal,
        delivery_fee: deliveryFee,
        payment_method: effectivePaymentMethod,
        payment_ref: vars?.payment_ref ?? null,
        payment_status: vars?.payment_status ?? null,
        zone: shipping.zone_name,
        city_id: shipping.city_id,
        zone_id: shipping.zone_id,
      };

      console.log("Initiating Order creation with payload:", payload);
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: payload,
      });

      if (error) {
        console.error("Function Invocation Error:", error);
        try {
          const errorDetails = await (error as any).context?.json();
          console.error("Detailed Error Body:", errorDetails);
          throw new Error(
            errorDetails?.error || errorDetails?.details || error.message
          );
        } catch {
          throw new Error(error.message || "Order creation failed");
        }
      }

      const summary = {
        items: payload.items,
        total: grandTotal,
        orderNumber: `#ORD-${Math.floor(Math.random() * 1000000)}`,
        date: new Date().toLocaleString(),
      };

      await clearCart();
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      return { ...summary, orderId: (data as any)?.order_id };
    },
    onSuccess: (data) => {
      setOrderSummary(data);
      setStep(3);
    },
    onError: (err: any) => toast.error(`Checkout Error: ${err.message}`),
  });

  const handlePayAndPlaceOrder = useCallback(async () => {
    if (!user || !profile?.onboarding_completed) {
      toast.error("Please login and complete onboarding to continue");
      return;
    }

    if (paymentMethod === "pod") {
      placeOrder.mutate({
        payment_method: "pod",
        payment_status: "pending",
        payment_ref: null,
      });
      return;
    }

    const email = user.email;
    if (!email) {
      toast.error("Your account email is missing; please re-login and try again");
      return;
    }

    setIsPaystackProcessing(true);
    try {
      const { data: pkData, error: pkError } = await supabase.functions.invoke(
        "paystack-public-key",
        { body: {} }
      );
      if (pkError) throw pkError;

      const publicKey = (pkData as any)?.publicKey as string | undefined;
      if (!publicKey) throw new Error("Missing Paystack public key");

      const amountKobo = Math.round(grandTotal * 100);
      const reference = `LKUP_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

      const paid = await pay({
        publicKey,
        email,
        amountKobo,
        reference,
        metadata: {
          source: "checkout",
          items_count: cartItems.length,
          total_naira: grandTotal,
        },
      });

      const { data: verifyData, error: verifyError } =
        await supabase.functions.invoke("verify-paystack", {
          body: { reference: paid.reference, amount_kobo: amountKobo },
        });

      if (verifyError || !(verifyData as any)?.verified) {
        throw new Error("Payment verification failed");
      }

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
  }, [
    user,
    profile?.onboarding_completed,
    paymentMethod,
    placeOrder,
    pay,
    grandTotal,
    cartItems.length,
  ]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        );
        const data = await res.json();
        setShipping((prev) => ({
          ...prev,
          address: data.display_name,
          city: data.address.city || data.address.town || "",
        }));
        toast.success("Location synchronized");
      } catch {
        setShipping((prev) => ({
          ...prev,
          address: `${pos.coords.latitude}, ${pos.coords.longitude}`,
        }));
      } finally {
        setIsDetecting(false);
        setShowLocationPrompt(false);
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 px-4">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <Check size={18} /> : i + 1}
              </div>
              <span className="text-[10px] uppercase font-bold">{s}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Review Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cartItems.map((item: any) => (
                <div
                  key={item.product_id}
                  className="flex justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <span>
                    {item.products?.title} (x{item.quantity})
                  </span>
                  <span className="font-bold">
                    ₦
                    {((item.products?.price ?? 0) * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Products subtotal</span>
                  <span className="font-semibold">
                    ₦{productTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Truck size={12} /> Delivery fee
                  </span>
                  <span className="font-semibold">
                    ₦{deliveryFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between font-black text-lg pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">
                    ₦{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep(1)}>
                Confirm & Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="p-8 space-y-4">
              {showLocationPrompt ? (
                <div className="text-center space-y-4">
                  <LocateFixed className="mx-auto text-primary" size={48} />
                  <h2 className="text-2xl font-bold">Delivery Location</h2>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleDetectLocation}
                      disabled={isDetecting}
                    >
                      {isDetecting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Navigation size={16} />
                      )}{" "}
                      Use Live Location
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowLocationPrompt(false)}
                    >
                      Manual Entry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name</Label>
                    <Input
                      value={shipping.name}
                      onChange={(e) =>
                        setShipping({ ...shipping, name: e.target.value })
                      }
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number</Label>
                    <Input
                      value={shipping.phone}
                      onChange={(e) =>
                        setShipping({ ...shipping, phone: e.target.value })
                      }
                      placeholder="080..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>City</Label>
                    <Select
                      value={shipping.city_id}
                      onValueChange={(val) => {
                        const city = cities.find((c: any) => c.id === val);
                        setShipping({
                          ...shipping,
                          city_id: val,
                          city_name: city?.name || "",
                          zone_id: "",
                          zone_name: "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city: any) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Delivery Zone</Label>
                    <Select
                      value={shipping.zone_id}
                      onValueChange={(val) => {
                        const zone = zones.find((z: any) => z.id === val);
                        setShipping({
                          ...shipping,
                          zone_id: val,
                          zone_name: zone?.name || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your delivery zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone: any) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label>Detailed Address</Label>
                    <Input
                      value={shipping.address}
                      onChange={(e) =>
                        setShipping({ ...shipping, address: e.target.value })
                      }
                      placeholder="Street name, house number, area..."
                    />
                  </div>
                  <Button
                    className="md:col-span-2 mt-4"
                    onClick={() => {
                      if (
                        !shipping.name ||
                        !shipping.phone ||
                        !shipping.address ||
                        !shipping.zone_id
                      ) {
                        toast.error("Please fill in all shipping details");
                        return;
                      }
                      setStep(2);
                    }}
                  >
                    Review Payment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="gap-0 rounded-xl border overflow-hidden bg-muted/20"
              >
                <div>
                  <RadioGroupItem
                    value="direct"
                    id="pm-direct"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="pm-direct"
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      paymentMethod === "direct" && "bg-accent/30"
                    )}
                  >
                    <CreditCard size={20} className="text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Direct Payment</p>
                      <p className="text-xs text-muted-foreground">
                        Pay now — held in escrow until you confirm receipt
                      </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black">
                      Recommended
                    </Badge>
                  </Label>
                </div>
                <div className="border-t">
                  <RadioGroupItem
                    value="pod"
                    id="pm-pod"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="pm-pod"
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      paymentMethod === "pod" && "bg-accent/30"
                    )}
                  >
                    <Banknote size={20} className="text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Pay on Delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Cash payment to rider upon receipt
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Products</span>
                  <span className="font-semibold">
                    ₦{productTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck size={12} /> Delivery fee
                  </span>
                  <span className="font-semibold">
                    ₦{deliveryFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between font-black pt-1 border-t">
                  <span>Grand Total</span>
                  <span className="text-primary text-lg">
                    ₦{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handlePayAndPlaceOrder}
                disabled={placeOrder.isPending || isPaystackProcessing}
              >
                {placeOrder.isPending || isPaystackProcessing
                  ? "Processing..."
                  : paymentMethod === "pod"
                    ? "Place Order (Pay on Delivery)"
                    : `Pay ₦${grandTotal.toLocaleString()}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && orderSummary && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto text-primary-foreground">
              <Check size={40} />
            </div>
            <h2 className="text-3xl font-black">Order Successful!</h2>
            <Receipt {...orderSummary} />
            <Button onClick={() => navigate("/orders")}>View All Orders</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
