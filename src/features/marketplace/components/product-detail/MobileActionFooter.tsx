import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50 p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
      <div className="bg-foreground/90 backdrop-blur-3xl p-3 px-4 rounded-xl border border-white/10 shadow-2xl flex items-center justify-between gap-4">
        <div className="flex flex-col pl-2">
          <span className="text-[10px] text-accent font-bold uppercase tracking-widest leading-none mb-1">Total Due</span>
          <span className="text-card font-black text-lg leading-none">₦{product.price.toLocaleString()}</span>
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
