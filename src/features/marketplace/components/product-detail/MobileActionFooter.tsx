import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MobileActionFooterProps {
  product: any;
  selectedSize: string | null;
  addToCart: (productId: string, quantity: number, size?: string) => void;
}

export function MobileActionFooter({
  product,
  selectedSize,
  addToCart
}: MobileActionFooterProps) {
  const navigate = useNavigate();

  const { data: feeConfigs = [] } = useQuery({
    queryKey: ["fee-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_config").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
  const productFeeConfig = feeConfigs.find((f: any) => f.fee_type === "platform_product");
  const platformProductRate = productFeeConfig?.rate ?? 0.10;
  const markupMultiplier = 1 + platformProductRate;
  const finalPrice = product.price * markupMultiplier;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50 p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
      <div className="bg-foreground/90 backdrop-blur-3xl p-3 px-4 rounded-xl border border-white/10 shadow-2xl flex items-center justify-between gap-4">
        <div className="flex flex-col pl-2">
          <span className="text-[10px] text-accent font-bold uppercase tracking-widest leading-none mb-1">Total Due (+{platformProductRate * 100}% Fee)</span>
          <span className="text-card font-black text-lg leading-none">₦{finalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <Button
          className="bg-primary text-primary-foreground h-11 rounded-xl px-8 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 flex-1"
          onClick={() => {
            if (product.sizes && product.sizes.length > 0 && !selectedSize) {
              toast.error("Please select a size first");
              return;
            }
            if ((product.inventory || 0) <= 0) {
              toast.error("This item is out of stock");
              return;
            }
            addToCart(product.id, 1, selectedSize || undefined);
            navigate("/checkout");
          }}
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}
