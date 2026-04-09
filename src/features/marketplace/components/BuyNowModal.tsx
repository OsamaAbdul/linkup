import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { ChevronRight, ShieldCheck, MapPin, Store, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getStoredPromoterId } from "@/features/promoter/hooks/useReferral";

interface BuyNowModalProps {
    product: any;
    isOpen: boolean;
    onClose: () => void;
}

export function BuyNowModal({ product, isOpen, onClose }: BuyNowModalProps) {
    const { user, profile, roles } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    if (!product) return null;

    const deliveryFee = 700;
    const total = product.price + deliveryFee;
    const sellerName = product.profiles?.display_name || "Seller";
    const sellerInitial = sellerName[0]?.toUpperCase() ?? "S";
    const isComplete = profile?.onboarding_completed;
    const deliveryAddress = (profile as any)?.address || "No address on file — update in profile";


    const placeOrder = useMutation({
        mutationFn: async () => {
            console.log("Starting placeOrder mutation...");
            console.log("Current user:", user?.id);
            console.log("Current product:", product?.id);

            if (!user) {
                toast.info("Please sign in to complete your order");
                navigate("/auth?redirect=/product/" + product.id);
                return;
            }

            if (!isComplete) {
                toast.info("Please complete your profile before ordering");
                navigate("/onboarding?redirect=/product/" + product.id);
                return;
            }


            // Force a session refresh to ensure we have a valid, fresh JWT
            const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

            if (sessionError || !session) {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) throw new Error("Your session is invalid or has expired. Please log out and back in.");
            }

            // Resolve promoter from referral tracking
            const resolvedPromoterId = await getStoredPromoterId();

            const payload = {
                seller_id: product.seller_id,
                items: [{
                    product_id: product.id,
                    quantity: 1,
                    price: product.price,
                    title: product.title,
                    image: product.images?.[0] || ""
                }],
                shipping_address: {
                    name: (profile as any)?.display_name || "",
                    address: (profile as any)?.address || "",
                    phone: (profile as any)?.phone || "",
                    city: (profile as any)?.city || "Abuja"
                },
                total: product.price,
                promoter_id: resolvedPromoterId,
            };

            const { data: functionData, error: functionError } = await supabase.functions.invoke('create-order', {
                body: payload,
                headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (functionError) throw new Error(functionError.message || "Failed to create order");

            // Clear referral after successful order
            localStorage.removeItem("linkup_ref");
            localStorage.removeItem("linkup_ref_expiry");

            return functionData as any;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product"] });
            toast.success("Order placed successfully!");
            onClose();
            navigate("/orders");
        },
        onError: (err: any) => {
            console.error("Mutation error highlight:", err);
            toast.error("Failed to place order: " + (err.message || "Unknown error"));
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden gap-0 rounded-xl bg-[#F8F9FB]">
                <DialogHeader className="p-4 bg-white border-b flex flex-row items-center justify-between sticky top-0 z-10">
                    <DialogTitle className="text-center w-full font-bold text-lg">Buy Now</DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Product Summary */}
                    <div className="flex gap-4">
                        <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                            {product.images?.[0] && <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 space-y-1">
                            <h3 className="font-semibold text-foreground line-clamp-1">{product.title}</h3>
                            <p className="font-bold text-lg">₦{product.price.toLocaleString()}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1"><Store size={12} className="text-blue-600" /> {sellerName}</span>
                                {product.distance && (
                                    <><span>·</span>
                                        <span className="flex items-center gap-1"><MapPin size={12} /> {product.distance}</span></>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Trust Badge */}
                    <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <ShieldCheck className="text-amber-500 fill-amber-100 flex-shrink-0" size={20} />
                        <p className="text-xs text-amber-900 leading-relaxed">
                            <span className="font-bold">Safe Holding:</span> Your payment is held securely until you confirm delivery.
                        </p>
                    </div>

                    {/* Delivery Address */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Delivery Address</h4>
                            <Button variant="link" className="h-auto p-0 text-primary text-xs font-semibold">Change</Button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white border rounded-xl">
                            <span className="text-sm font-medium">{deliveryAddress}</span>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </div>
                    </div>

                    {/* Delivery Method */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Delivery Method</h4>
                        <RadioGroup defaultValue="standard" className="gap-3">
                            <div>
                                <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
                                <Label htmlFor="standard" className="flex items-center justify-between p-3 bg-white border-2 border-transparent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 rounded-xl cursor-pointer transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full border-2 border-muted peer-data-[state=checked]:border-primary flex items-center justify-center">
                                            <div className="h-2.5 w-2.5 rounded-full bg-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Standard Delivery</p>
                                            <p className="text-xs text-muted-foreground">Arrives in 1 - 3 days</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm">₦{deliveryFee}</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Payment Method - Premium Paystack Only */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Payment Method</h4>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <ShieldCheck size={10} className="text-blue-500" /> Secure
                            </div>
                        </div>
                        <div className="relative group overflow-hidden rounded-xl border border-[#09A5DB]/20 bg-white p-3.5 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#09A5DB]/5 p-2 rounded-lg">
                                        <img 
                                            src="https://checkout.paystack.com/assets/img/logo.svg" 
                                            alt="Paystack" 
                                            className="h-4 w-auto brightness-0"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.insertAdjacentHTML('afterbegin', '<span class=\"font-black text-[#09A5DB] text-[10px]\">Paystack</span>');
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-foreground">Direct Payment</p>
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            Via Paystack · Cards, USSD, Transfer
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[9px] border-[#09A5DB]/30 text-[#09A5DB] font-bold">ACTIVE</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-2 pt-2 pb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">₦{product.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Delivery Fee</span>
                            <span className="font-medium">₦{deliveryFee}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold text-[#27ae60] pt-2 border-t mt-2">
                            <span>Total</span>
                            <span>₦{total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={placeOrder.isPending}>Back</Button>
                    <Button
                        className="flex-[2] rounded-xl bg-[#4169E1] hover:bg-[#3158D3] text-white"
                        onClick={() => placeOrder.mutate()}
                        disabled={placeOrder.isPending}
                    >
                        {placeOrder.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        {placeOrder.isPending ? "Starting..." : `Pay ₦${total.toLocaleString()}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

