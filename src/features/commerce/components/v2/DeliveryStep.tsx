import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { MapPin, Navigation, Loader2, Phone, User, Home } from "lucide-react";
import { motion } from "framer-motion";

interface DeliveryStepProps {
  shipping: {
    name: string;
    address: string;
    city_id: string;
    zone_id: string;
    phone: string;
  };
  setShipping: (data: any) => void;
  cities: any[];
  zones: any[];
  onNext: () => void;
  isDetecting: boolean;
  onDetectLocation: () => void;
}

export function DeliveryStep({
  shipping,
  setShipping,
  cities,
  zones,
  onNext,
  isDetecting,
  onDetectLocation,
}: DeliveryStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!shipping.name) newErrors.name = "Receiver name is required";
    if (!shipping.phone || shipping.phone.length < 10) newErrors.phone = "Valid phone number is required";
    if (!shipping.city_id) newErrors.city = "City selection is required";
    if (!shipping.zone_id) newErrors.zone = "Zone selection is required";
    if (!shipping.address || shipping.address.length < 5) newErrors.address = "Detailed address is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl rounded-xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-foreground tracking-tight">Delivery Details</h2>
            <p className="text-xs text-muted-foreground">Where should we send your package?</p>
          </div>

          <div className="grid gap-6">
            {/* Receiver Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v2-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Receiver Name
                </Label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                  <Input
                    id="v2-name"
                    placeholder="Enter full name"
                    className="pl-11 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all shadow-inner focus:shadow-none"
                    value={shipping.name}
                    onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
                  />
                </div>
                {errors.name && <p className="text-[10px] text-destructive font-bold ml-1">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="v2-phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                  <Input
                    id="v2-phone"
                    placeholder="+234 ..."
                    className="pl-11 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all shadow-inner focus:shadow-none"
                    value={shipping.phone}
                    onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                  />
                </div>
                {errors.phone && <p className="text-[10px] text-destructive font-bold ml-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Location Detections */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between ml-1">
                 <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Location
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase tracking-tighter text-primary hover:bg-primary/5 rounded-full px-3"
                  onClick={onDetectLocation}
                  disabled={isDetecting}
                >
                  {isDetecting ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Navigation size={12} className="mr-1.5" />}
                  Auto-Detect
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={shipping.city_id}
                  onValueChange={(val) => {
                    const city = cities.find(c => c.id === val);
                    setShipping({ ...shipping, city_id: val, city_name: city?.name || "", zone_id: "", zone_name: "" });
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all shadow-inner">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl border-none">
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id} className="rounded-xl my-1">{city.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={shipping.zone_id}
                  onValueChange={(val) => {
                    const zone = zones.find(z => z.id === val);
                    setShipping({ ...shipping, zone_id: val, zone_name: zone?.name || "" });
                  }}
                  disabled={!shipping.city_id}
                >
                  <SelectTrigger className="h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all shadow-inner">
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl border-none">
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id} className="rounded-xl my-1">{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(errors.city || errors.zone) && <p className="text-[10px] text-destructive font-bold ml-1">Please select both city and zone</p>}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="v2-address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Full Address
              </Label>
              <div className="relative">
                <Home size={16} className="absolute left-4 top-5 text-primary" />
                <textarea
                  id="v2-address"
                  placeholder="Street name, house number, apartment, etc."
                  className="w-full min-h-[80px] pl-11 p-3 rounded-xl border border-muted bg-muted/20 focus:bg-white transition-all shadow-inner focus:shadow-none focus:outline-none focus:ring-1 focus:ring-primary/20 text-sm"
                  value={shipping.address}
                  onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                />
              </div>
              {errors.address && <p className="text-[10px] text-destructive font-bold ml-1">{errors.address}</p>}
            </div>
          </div>

          <Button
            onClick={handleNext}
            className="w-full h-16 rounded-xl bg-primary hover:bg-primary/95 text-white font-black text-lg shadow-2xl shadow-primary/30 transition-all active:scale-[0.98] group"
          >
            Review & Pay
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="ml-2"
            >
              →
            </motion.span>
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 px-8 py-2">
        <MapPin size={12} className="text-blue-500" />
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
          Available across 20+ zones in Abuja
        </p>
      </div>
    </motion.div>
  );
}

