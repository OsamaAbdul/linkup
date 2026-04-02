import { m } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Heart, ShoppingCart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductActionsProps {
  product: any;
  selectedSize: string | null;
  setSelectedSize: (size: string | null) => void;
  handleAddToCart: () => void;
  isProductLiked: boolean;
  toggleLike: (id: string) => void;
  user: any;
  animationProps: any;
  toggleAuth: () => void;
}

export function ProductActions({
  product,
  selectedSize,
  setSelectedSize,
  handleAddToCart,
  isProductLiked,
  toggleLike,
  user,
  animationProps,
  toggleAuth
}: ProductActionsProps) {
  const navigate = useNavigate();

  const handleBuyNow = () => {
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast.error("Please select a size first");
      return;
    }
    if ((product.inventory || 0) <= 0) {
      toast.error("Out of stock");
      return;
    }
    handleAddToCart();
    navigate("/checkout");
  };

  const handleChat = async () => {
    if (!user) {
      toggleAuth();
      return;
    }
    if (user.id === product.seller_id) {
      toast.error("You cannot chat with yourself");
      return;
    }

    const { data: existing } = await (supabase as any)
      .from("conversations")
      .select("id")
      .eq("product_id", product.id)
      .eq("buyer_id", user.id)
      .eq("seller_id", product.seller_id)
      .maybeSingle();

    if (existing) {
      navigate(`/chat/${existing.id}`);
    } else {
      const { data: newConv, error } = await (supabase as any)
        .from("conversations")
        .insert({
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller_id
        })
        .select("id")
        .single();

      if (error) {
        toast.error("Failed to initiate secure channel");
        return;
      }
      navigate(`/chat/${newConv.id}`);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-4">
      {/* Sizes Selection */}
      {product.sizes && product.sizes.length > 0 && (
        <m.div {...animationProps} transition={{ delay: 0.05 }} className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">Select Size</Label>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size: string) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={cn(
                  "h-12 w-16 rounded-xl border-2 font-black text-xs transition-all",
                  selectedSize === size
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                    : "bg-surface border-border/50 text-foreground/70 hover:border-primary/50"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </m.div>
      )}

      {/* Action Row */}
      <m.div {...animationProps} transition={{ delay: 0.1 }} className="lg:space-y-3 space-y-4">
        <div className="flex gap-3">
          <Button
            className="flex-1 h-12 lg:h-11 rounded-xl text-base lg:text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={handleAddToCart}
            disabled={(product.inventory || 0) <= 0}
          >
            <ShoppingCart className="mr-2" size={20} /> Add to Cart
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 lg:h-11 rounded-xl text-base lg:text-sm font-black uppercase tracking-widest border-primary text-primary hover:bg-primary/5 transition-all"
            onClick={handleBuyNow}
            disabled={(product.inventory || 0) <= 0}
          >
            Buy Now
          </Button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => toggleLike(product.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-12 lg:h-10 rounded-xl border transition-all text-sm font-bold shadow-sm",
              isProductLiked
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-surface border-border text-foreground/70"
            )}
          >
            <Heart size={18} className={cn(isProductLiked && "fill-current")} />
            {isProductLiked ? "Saved" : "Save Item"}
          </button>

          <button
            onClick={handleChat}
            className="flex-1 flex items-center justify-center gap-2 h-12 lg:h-10 rounded-xl bg-surface border border-border text-foreground/70 hover:bg-muted transition-all text-sm font-bold shadow-sm"
          >
            <MessageSquare size={18} />
            Ask Our Partner
          </button>
        </div>
      </m.div>
    </div>
  );
}
