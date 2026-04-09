import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { CreditCard, ShieldCheck, Truck, Lock, Loader2, ChevronLeft, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

interface PaymentStepProps {
  items: any[];
  productTotal: number;
  deliveryFee: number;
  grandTotal: number;
  sellerCount: number;
  onBack: () => void;
  onPay: () => void;
  isPending: boolean;
}

export function PaymentStep({
  items,
  productTotal,
  deliveryFee,
  grandTotal,
  sellerCount,
  onBack,
  onPay,
  isPending,
}: PaymentStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-xl">
        <CardHeader className="pb-2 px-6 pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="rounded-full -ml-4 text-muted-foreground hover:text-foreground h-8"
            >
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
              Step 2 of 2
            </Badge>
          </div>
          <CardTitle className="text-xl font-black mt-2 flex items-center gap-2">
            <CreditCard className="text-primary" size={24} />
            Secure Payment
          </CardTitle>
          <p className="text-xs text-muted-foreground">Review your order and pay securely</p>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Order Review Brief */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground ml-1">
              <ShoppingBag size={12} />
              Review Items
            </div>
            <div className="bg-muted/5 rounded-xl p-4 space-y-2 divide-y divide-black/[0.03]">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold line-clamp-1 max-w-[150px]">{item.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] text-muted-foreground font-medium">Qty: {item.quantity}</p>
                        {item.size && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black border-primary/20 text-primary bg-primary/5 uppercase">
                            Size: {item.size}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="font-black text-xs text-foreground">₦{item.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Paystack Premium Card */}
          <div className="relative group transition-all duration-300">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#09A5DB] to-[#000000] rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col items-center justify-between p-4 bg-white border border-[#09A5DB]/20 rounded-xl gap-4 outline outline-4 outline-[#09A5DB]/5">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="bg-[#09A5DB]/5 p-2 rounded-lg">
                    <img
                      src="/paystack.png"
                      alt="Paystack"
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-black text-base text-foreground">Direct Payment</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">Secured by Linkup Escrow</p>
                  </div>
                </div>
                <Badge className="bg-[#09A5DB]/10 text-[#09A5DB] border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest hidden sm:flex">
                  Verified
                </Badge>
              </div>

              <div className="w-full flex justify-between items-center px-2">
                <div className="flex gap-1.5 opacity-60 grayscale filter">
                  <div className="w-8 h-5 bg-muted rounded-[3px]" />
                  <div className="w-8 h-5 bg-muted rounded-[3px]" />
                  <div className="w-8 h-5 bg-muted rounded-[3px]" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#09A5DB] uppercase">
                  <Lock size={12} /> Protected
                </div>
              </div>
            </div>
          </div>

          {/* Trust Detail */}
          <div className="flex items-center gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
            <ShieldCheck className="text-amber-500 shrink-0" size={18} />
            <p className="text-[10px] text-amber-800/90 leading-tight font-bold">
              <span className="text-amber-900 mr-1">Secure Holding:</span>
              Your payment is held safely and only released to sellers after you confirm you've received your items.
            </p>
          </div>

          {/* Multi-Seller Notification */}
          {sellerCount > 1 && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-wider">
                <Truck size={14} />
                Different Deliveries
              </div>
              <p className="text-[10px] text-blue-800/90 leading-tight font-medium">
                You are buying from {sellerCount} different sellers. Since each seller will ship their items separately, there are multiple delivery charges included in your total.
              </p>
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Order Subtotal</span>
              <span className="text-foreground">₦{productTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Truck size={12} className="text-blue-500" /> Delivery {sellerCount > 1 ? `(${sellerCount} Packages)` : ''}
              </span>
              <span className="text-foreground">₦{deliveryFee.toLocaleString()}</span>
            </div>
            <div className="pt-4 border-t border-dashed flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Total to Pay</p>
                <p className="text-3xl font-black text-primary tracking-tighter">₦{grandTotal.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-muted-foreground italic mb-0.5">Authenticated</p>
                <Lock size={12} className="ml-auto text-primary" />
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 rounded-xl bg-primary hover:bg-primary/95 text-white font-black text-lg shadow-2xl shadow-primary/30 transition-all active:scale-[0.98] mt-2"
            onClick={onPay}
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin" size={20} />
                <span>Securing Payment...</span>
              </div>
            ) : (
              `Pay Now — ₦${grandTotal.toLocaleString()}`
            )}
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground px-12 font-medium leading-relaxed">
        By completing payment, you agree to Linkup's terms of service and acknowledge the escrow protection policy.
      </p>
    </motion.div>
  );
}
