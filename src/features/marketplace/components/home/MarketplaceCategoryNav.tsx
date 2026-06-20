import { cn } from "@/lib/utils";
import {
  Grid, Heart, Sparkles, Shirt, Laptop, Home as HomeIcon, ShoppingBag, Apple, MapPin,
  Filter, Search, SlidersHorizontal, ChevronDown, X,
} from "lucide-react";

// Icon map for categories
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Grid, Heart, Sparkles, Shirt, Laptop, Home: HomeIcon, ShoppingBag, Apple, MapPin,
  Filter, Search, SlidersHorizontal, ChevronDown, X,
};

interface MarketplaceCategoryNavProps {
  categories: any[];
  selectedTab: string;
  setSelectedTab: (category: string) => void;
}

export function MarketplaceCategoryNav({ categories, selectedTab, setSelectedTab }: MarketplaceCategoryNavProps) {
  const CATEGORY_TABS = [{ name: "All Products", icon: "Grid" }, ...categories];

  return (
    <div className="relative pt-1">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
        {CATEGORY_TABS.map(tab => {
          const Icon = CATEGORY_ICON_MAP[(tab as any).icon] || Grid;
          const tabName = (tab as any).name;
          const isActive = selectedTab === tabName;
          return (
            <button
              key={tabName}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedTab(tabName)}
              className={cn(
                "px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center gap-2 sm:gap-3 shrink-0 group relative shadow-sm border",
                isActive
                  ? "bg-primary border-primary text-white shadow-xl sm:shadow-2xl shadow-primary/30 -translate-y-0.5"
                  : "bg-white border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-md"
              )}
            >
              <Icon size={14} className={cn("transition-transform group-hover:scale-125 duration-500", isActive && "text-white scale-110")} />
              <span className="tracking-tight">{tabName}</span>
            </button>
          );
        })}
      </div>
      {/* Subtle Fade Edge */}
      <div className="absolute right-0 top-0 bottom-2 w-20 bg-gradient-to-l from-[#fafafa] to-transparent pointer-events-none" />
    </div>
  );
}
