import { Button } from "@/shared/components/ui/button";
import { Package } from "lucide-react";

interface MarketplaceEmptyStateProps {
  onReset: () => void;
}

export function MarketplaceEmptyState({ onReset }: MarketplaceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 bg-white/50 border border-black/[0.04] rounded-[32px] shadow-sm animate-in fade-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-primary/5 rounded-[24px] flex items-center justify-center mb-2">
        <Package size={48} className="text-primary/40" strokeWidth={1} />
      </div>
      <div>
        <h3 className="text-2xl font-black tracking-tight text-foreground">No products found</h3>
        <p className="text-muted-foreground mt-2 font-medium max-w-[300px] mx-auto text-sm">
          We couldn't find anything matching your current filters or search terms.
        </p>
      </div>
      <Button 
        variant="outline" 
        onClick={onReset}
        className="mt-4 rounded-xl border-border/50 font-black uppercase tracking-widest text-[10px] hover:bg-primary/5 hover:text-primary transition-all"
      >
        Clear All Filters
      </Button>
    </div>
  );
}
