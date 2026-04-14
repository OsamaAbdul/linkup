import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { ShieldCheck, MapPin, Store, Truck, CreditCard, Package, Lock, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Receipt from "./Receipt";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getReferralAttribution } from "@/features/promoter/hooks/useReferral";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";

interface CheckoutModalProps {
    product: any;
    isOpen: boolean;
    onClose: () => void;
}

const DELIVERY_FEE = 1500; // Legacy fallback

export function CheckoutModal({ product, isOpen, onClose }: CheckoutModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [deliveryMethod, setDeliveryMethod] = useState("standard");
    const paymentMethod = "direct"; 
    const [receiverName, setReceiverName] = useState("");
    const [phone, setPhone] = useState("");
    const [cityId, setCityId] = useState("");
    const [cityName, setCityName] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [zoneName, setZoneName] = useState("");
    const [address, setAddress] = useState("");
    const [note, setNote] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [orderSummary, setOrderSummary] = useState<any>(null);

    const { data: cities = [] } = useQuery({
        queryKey: ["cities"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).from("cities").select("*").eq("is_active", true).order("name");
            if (error) throw error;
            return (data as any[]) || [];
        }
    });

    const { data: zones = [] } = useQuery({
        queryKey: ["zones", cityId],
        queryFn: async () => {
            if (!cityId) return [];
            const { data, error } = await (supabase as any).from("delivery_zones")
                .select("*")
                .eq("city_id", cityId)
                .eq("is_active", true)
                .order("name");
            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: !!cityId
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
        }
    });

    // Auto-select Abuja if available
    useEffect(() => {
        const abuja = cities.find(c => c.name === "Abuja");
        if (abuja && !cityId) {
            setCityId(abuja.id);
            setCityName(abuja.name);
        }
    }, [cities, cityId]);


    const riderFeeConfig = feeConfigs.find((f: any) => f.fee_type === "rider");
    const dynamicDefaultFee = riderFeeConfig?.flat_fee ?? DELIVERY_FEE;

    const selectedZone = zones.find(z => z.id === zoneId);
    const zFee = selectedZone?.delivery_fee;
    const baseFee = (zFee === 1500 || zFee === null || zFee === undefined) ? dynamicDefaultFee : zFee;
    const deliveryFee = deliveryMethod === "standard" ? baseFee : 0;
    const productPrice = product.price;
    const grandTotal = productPrice + deliveryFee;

    const checkoutMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Must be logged in");

            const summary = {
                items: [{ title: product.title, quantity: 1, price: product.price }],
                total: grandTotal,
                deliveryFee,
                paymentMethod,
                orderNumber: `#ORD-${Math.floor(Math.random() * 1000000)}`,
                date: new Date().toLocaleString()
            };

            const shippingAddress = {
                receiver_name: receiverName,
                phone,
                address,
                note,
                method: deliveryMethod
            };

            // Resolve promoter attribution from referral tracking
            const { promoter_id: resolvedPromoterId, visitor_id: resolvedVisitorId } = await getReferralAttribution();

            const payload = {
                seller_id: product.seller_id,
                items: [{ 
                    product_id: product.id, 
                    quantity: 1, 
                    price: product.price, 
                    seller_id: product.seller_id,
                    title: product.title,
                    image: product.images?.[0] || ""
                }],
                shipping_address: shippingAddress,
                total: productPrice,
                delivery_fee: deliveryFee,
                payment_method: paymentMethod,
                zone: zoneName,
                city_id: cityId,
                zone_id: zoneId,
                promoter_id: resolvedPromoterId,
                visitor_id: resolvedVisitorId,
            };

            // Refresh session to ensure valid JWT
            const { error: sessionError } = await supabase.auth.refreshSession();
            if (sessionError) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Session expired. Please log in again.");
            }

            const { error: functionError } = await supabase.functions.invoke("create-order", { body: payload });
            if (functionError) throw new Error(functionError.message || "Failed to create order");

            // Clear referral after successful order
            localStorage.removeItem("linkup_ref");
            localStorage.removeItem("linkup_ref_expiry");

            return summary;
        },
        onSuccess: (summary) => {
            setOrderSummary(summary);
            setIsSuccess(true);
            toast.success("Order placed successfully!");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product", product.id] });
            setReceiverName(""); setPhone(""); setAddress(""); setNote("");
        },
        onError: (error: any) => toast.error("Failed to place order: " + error.message)
    });

    const handlePayment = () => {
        if (!receiverName || !phone || !address || (deliveryMethod === "standard" && !zoneId)) {
            toast.error("Please fill in all delivery details and select a zone");
            return;
        }
        checkoutMutation.mutate();
    };

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden gap-0 rounded-xl bg-[#F8F9FB]">
                <DialogHeader className="p-4 bg-white border-b flex flex-row items-center justify-between sticky top-0 z-10">
                    <DialogTitle className="text-center w-full font-bold text-lg">Checkout</DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-5 max-h-[82vh] overflow-y-auto">
                    {isSuccess ? (
                        <div className="text-center py-6 space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="space-y-2">
                                <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-green-500/20">
                                    <ShieldCheck size={32} className="animate-bounce" />
                                </div>
                                <h2 className="text-2xl font-black text-foreground">
                                    Payment Received!
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Your payment is secured in escrow until delivery.
                                </p>
                            </div>

                            {orderSummary && (
                                <div className="flex justify-center transform scale-[0.85] origin-top">
                                    <Receipt items={orderSummary.items} total={orderSummary.total}
                                        orderNumber={orderSummary.orderNumber} date={orderSummary.date} />
                                </div>
                            )}

                            <Button className="w-full h-12 bg-primary text-primary-foreground" onClick={() => { setIsSuccess(false); onClose(); }}>
                                Close & Return
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Product Summary */}
                            <div className="flex gap-4 p-3 bg-white rounded-xl border border-black/5">
                                <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                                    {product.images?.[0] && <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h3 className="font-semibold text-foreground line-clamp-1">{product.title}</h3>
                                    <p className="font-bold text-base">₦{productPrice.toLocaleString()}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Store size={11} className="text-blue-500" /> {product.profiles?.display_name || "Seller"}
                                    </div>
                                </div>
                            </div>

                            {/* Escrow trust badge */}
                            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <ShieldCheck className="text-amber-500 fill-amber-100 flex-shrink-0" size={18} />
                                <p className="text-xs text-amber-900 leading-relaxed">
                                    <span className="font-bold">Escrow Safe:</span> Payment held securely and released to seller only after you confirm receipt.
                                </p>
                            </div>

                            {/* Delivery Details */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Delivery Details</h4>
                                <div className="space-y-1.5">
                                    <Label htmlFor="name" className="text-xs text-muted-foreground font-medium">Receiver's Name</Label>
                                    <Input id="name" placeholder="Full name" className="bg-white border-input/60 rounded-xl h-11"
                                        value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone" className="text-xs text-muted-foreground font-medium">Phone Number</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 border-r pr-2">
                                            <span className="text-lg leading-none">🇳🇬</span>
                                        </div>
                                        <Input id="phone" placeholder="+234 ..." className="pl-14 bg-white border-input/60 rounded-xl h-11"
                                            value={phone} onChange={(e) => setPhone(e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground font-medium">City</Label>
                                        <Select value={cityId} onValueChange={(val) => {
                                            const city = cities.find(c => c.id === val);
                                            setCityId(val);
                                            setCityName(city?.name || "");
                                            setZoneId("");
                                            setZoneName("");
                                        }}>
                                            <SelectTrigger className="bg-white border-input/60 rounded-xl h-11">
                                                <SelectValue placeholder="City" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cities.map(city => (
                                                    <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground font-medium">Zone</Label>
                                        <Select value={zoneId} onValueChange={(val) => {
                                            const zone = zones.find(z => z.id === val);
                                            setZoneId(val);
                                            setZoneName(zone?.name || "");
                                        }} disabled={!cityId}>
                                            <SelectTrigger className="bg-white border-input/60 rounded-xl h-11">
                                                <SelectValue placeholder="Select Zone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {zones.map(zone => (
                                                    <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="address" className="text-xs text-muted-foreground font-medium">Delivery Address</Label>
                                    <Input id="address" placeholder="Street name, house number, area..." className="bg-white border-input/60 rounded-xl h-11"
                                        value={address} onChange={(e) => setAddress(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="note" className="text-xs text-muted-foreground font-medium">Delivery Note (Optional)</Label>
                                    <Input id="note" placeholder="E.g. Call before arrival" className="bg-white border-input/60 rounded-xl h-11"
                                        value={note} onChange={(e) => setNote(e.target.value)} />
                                </div>
                            </div>

                            {/* Delivery Method */}
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Delivery Method</h4>
                                <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod}
                                    className="gap-0 rounded-xl border overflow-hidden bg-white">
                                    <div>
                                        <RadioGroupItem value="standard" id="dm-standard" className="peer sr-only" />
                                        <Label htmlFor="dm-standard" className={cn("flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors", deliveryMethod === "standard" && "bg-blue-50/70")}>
                                            <div className="flex items-center gap-3">
                                                <Truck size={15} className="text-blue-600 shrink-0" />
                                                <div>
                                                    <p className="font-medium text-sm">Standard Delivery</p>
                                                    <p className="text-[11px] text-muted-foreground">Delivered by a verified rider</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-sm">₦1,500</span>
                                        </Label>
                                    </div>
                                    <div className="border-t">
                                        <RadioGroupItem value="pickup" id="dm-pickup" className="peer sr-only" />
                                        <Label htmlFor="dm-pickup" className={cn("flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors", deliveryMethod === "pickup" && "bg-blue-50/70")}>
                                            <div className="flex items-center gap-3">
                                                <Package size={15} className="text-green-600 shrink-0" />
                                                <div>
                                                    <p className="font-medium text-sm">Self Pickup</p>
                                                    <p className="text-[11px] text-muted-foreground">Collect from seller location</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-sm text-green-600">Free</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Payment Method */}
                            {/* Payment Method - Premium Paystack Only */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Payment Method</h4>
                                <div className="relative group overflow-hidden rounded-xl border border-[#09A5DB]/20 bg-white p-4 transition-all duration-300">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <CreditCard size={40} className="text-[#09A5DB]" />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[#09A5DB]/5 p-2.5 rounded-xl">
                                            <img 
                                                src="https://checkout.paystack.com/assets/img/logo.svg" 
                                                alt="Paystack" 
                                                className="h-5 w-auto brightness-0"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.insertAdjacentHTML('afterbegin', '<span class=\"font-black text-[#09A5DB] text-sm\">Paystack</span>');
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-foreground">Direct Payment</p>
                                                <Badge className="bg-[#09A5DB]/10 text-[#09A5DB] border-none text-[8px] font-black uppercase">Verified</Badge>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">Encrypted by Paystack</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Summary Breakdown */}
                            <div className="bg-white rounded-xl border border-black/5 overflow-hidden">
                                <div className="px-4 py-3 border-b">
                                    <h4 className="font-semibold text-sm">Order Summary</h4>
                                </div>
                                <div className="px-4 py-3 space-y-2.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Product price</span>
                                        <span className="font-bold text-sm">₦{productPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Truck size={12} /> Delivery fee
                                        </span>
                                        <span className={cn("font-semibold", deliveryFee === 0 && "text-green-600")}>
                                            {deliveryFee === 0 ? "Free" : `₦${deliveryFee.toLocaleString()}`}
                                        </span>
                                    </div>
                                    <div className="border-t pt-2.5 flex justify-between items-center">
                                        <div>
                                            <span className="font-bold text-sm">Grand Total</span>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                                <Lock size={10} /> Secure checkout
                                            </div>
                                        </div>
                                        <span className="font-black text-xl text-primary">₦{grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isSuccess && (
                    <div className="p-4 bg-white border-t flex gap-3">
                        <Button variant="secondary" className="flex-1 rounded-xl bg-muted/80 hover:bg-muted"
                            onClick={onClose} disabled={checkoutMutation.isPending}>Back</Button>
                        <Button
                            className="flex-[2] h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-lg shadow-primary/20 gap-2 transition-all active:scale-[0.98]"
                            onClick={handlePayment}
                            disabled={checkoutMutation.isPending}
                        >
                            {checkoutMutation.isPending ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>Securing...</span>
                                </>
                            ) : (
                                `Confirm & Pay ₦${grandTotal.toLocaleString()}`
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

