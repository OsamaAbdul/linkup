import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight, ShoppingBag, Home } from "lucide-react";
import { motion } from "framer-motion";
import Receipt from "../Receipt";
import { Link } from "react-router-dom";

interface SuccessStepProps {
  orderSummary: any;
  onClose: () => void;
}

export function SuccessStep({ orderSummary, onClose }: SuccessStepProps) {
  if (!orderSummary) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-10 space-y-10"
    >
      <div className="relative pt-6">
        <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              y: [0, -15, 0]
            }}
            transition={{ 
              scale: { type: "spring", stiffness: 200, damping: 15 },
              opacity: { duration: 0.5 },
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            className="relative z-10 mx-auto w-48 h-48 md:w-64 md:h-64"
        >
            <img 
              src="/sucess-hand.png" 
              alt="Success" 
              className="w-full h-full object-contain drop-shadow-2xl"
            />
            
            {/* Success Badge Overlay */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="absolute -bottom-2 -right-2 bg-green-500 text-white p-3 rounded-xl shadow-xl border-4 border-white"
            >
              <ShieldCheck size={24} strokeWidth={3} />
            </motion.div>
        </motion.div>
        
        {/* Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -z-0" />
      </div>
        
        <div className="space-y-2">
            <h2 className="text-4xl font-black text-foreground tracking-tight">Payment Received!</h2>
            <p className="text-base text-muted-foreground font-medium">
                Order <span className="text-primary font-bold">{orderSummary.orderNumber}</span> is now secured in escrow.
            </p>
        </div>

      <div className="max-w-md mx-auto transform scale-110">
        <Receipt 
            items={orderSummary.items} 
            total={orderSummary.total}
            orderNumber={orderSummary.orderNumber} 
            date={orderSummary.date} 
        />
      </div>

      <div className="grid gap-4 pt-10 px-8">
        <Link to="/orders" className="w-full">
            <Button size="lg" className="w-full h-16 rounded-xl bg-primary hover:bg-primary/95 text-white font-black text-lg gap-3">
                <ShoppingBag size={20} />
                Manage My Orders
                <ArrowRight size={20} />
            </Button>
        </Link>
        <Link to="/" className="w-full">
            <Button variant="ghost" className="w-full h-14 rounded-xl font-bold text-muted-foreground hover:text-foreground gap-2">
                <Home size={18} />
                Return to Home
            </Button>
        </Link>
      </div>

      <p className="text-[10px] text-muted-foreground font-medium px-12 leading-relaxed max-w-sm mx-auto">
        Your payment will be released to the seller only after you confirm that your item has been delivered and meets your expectations.
      </p>
    </motion.div>
  );
}

