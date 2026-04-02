import { m } from "framer-motion";
import { ShieldCheck, Clock } from "lucide-react";

interface ProductTrustTagsProps {
  animationProps: any;
}

export function ProductTrustTags({ animationProps }: ProductTrustTagsProps) {
  return (
    <m.div {...animationProps} transition={{ delay: 0.2 }} className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-y border-border/40">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-primary" size={20} />
        <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80">Authenticity Verified</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="text-primary" size={20} />
        <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80">Fast Delivery</span>
      </div>
    </m.div>
  );
}
