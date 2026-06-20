import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Slider } from "@/shared/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/lib/utils";

interface MarketplaceSearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  sortOption: string;
  setSortOption: (value: string) => void;
  priceRange: number[];
  setPriceRange: (value: number[]) => void;
  selectedZone: string;
  setSelectedZone: (value: string) => void;
  zones: any[];
  onReset: () => void;
}

export function MarketplaceSearchBar({
  searchInput,
  setSearchInput,
  sortOption,
  setSortOption,
  priceRange,
  setPriceRange,
  selectedZone,
  setSelectedZone,
  zones,
  onReset,
}: MarketplaceSearchBarProps) {
  return (
    <div className="flex flex-row gap-2 sm:gap-4 items-center">
      <div className="relative flex-1 w-full group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition duration-1000" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 sm:h-5 sm:w-5 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search products, brands..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 sm:pl-12 bg-white/70 backdrop-blur-2xl border-border/30 h-11 sm:h-12 rounded-xl text-[13px] sm:text-sm font-medium shadow-sm transition-all focus:bg-white focus:ring-0 focus:border-primary/30"
            aria-label="Search products"
          />
        </div>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="h-11 sm:h-12 px-3 sm:px-6 gap-2 bg-white/90 backdrop-blur-md border-border/30 rounded-xl font-black text-muted-foreground hover:text-foreground hover:bg-white shadow-sm transition-all active:scale-95 shrink-0 uppercase tracking-widest text-[8px] sm:text-[9px] w-auto">
            <SlidersHorizontal size={16} />
            <span className="hidden xs:inline">Filters</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md rounded-l-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="h-full flex flex-col">
            <SheetHeader className="p-6 pb-0">
              <SheetTitle className="text-xl font-black tracking-tighter">Refine Hub</SheetTitle>
              <SheetDescription className="text-sm font-medium">Precision filters for your perfect find.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  Sort Order
                </h3>
                <RadioGroup value={sortOption} onValueChange={setSortOption} className="gap-1.5">
                  {["newest", "price_asc", "price_desc", "nearby"].map((val) => (
                    <div key={val} className="flex items-center space-x-2.5 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50">
                      <RadioGroupItem value={val} id={val} className="text-primary border-primary/30" />
                      <Label htmlFor={val} className="font-bold flex-1 cursor-pointer capitalize text-xs">
                        {val === "nearby" ? "Nearby (Proximity)" : val.replace("_", ": ").replace("asc", "Low to High").replace("desc", "High to Low")}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator className="opacity-30" />

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Price Spectrum
                  </h3>
                  <span className="text-base font-black text-primary">₦{priceRange[1].toLocaleString()}+</span>
                </div>
                <Slider
                  defaultValue={[0, 1000000]}
                  max={1000000}
                  step={5000}
                  value={priceRange}
                  onValueChange={setPriceRange}
                  className="py-2"
                />
              </div>

              <Separator className="opacity-30" />

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Regional Access
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedZone("")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                      !selectedZone ? "bg-primary text-white border-primary shadow-xl shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/20"
                    )}
                  >
                    All Zones
                  </button>
                  {zones.map((z: any) => (
                    <button
                      key={z.id}
                      onClick={() => setSelectedZone(z.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                        selectedZone === z.id ? "bg-primary text-white border-primary shadow-xl shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/20"
                      )}
                    >
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 pt-0">
              <Button variant="ghost" className="w-full h-12 rounded-xl font-black uppercase text-[9px] tracking-[0.25em] text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-all" onClick={onReset}>
                Reset Parameters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
