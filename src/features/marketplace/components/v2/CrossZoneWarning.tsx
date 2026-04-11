import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Truck } from "lucide-react";
import { motion } from "framer-motion";

interface CrossZoneWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CrossZoneWarning({ open, onOpenChange, onConfirm }: CrossZoneWarningProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-w-[400px] p-8 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-primary to-orange-500" />
        
        <AlertDialogHeader className="items-center text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center rotate-3 shadow-inner"
          >
            <Truck className="text-blue-600" size={40} />
          </motion.div>
          
          <div className="space-y-2">
            <AlertDialogTitle className="text-3xl font-black tracking-tighter text-foreground">
              Cross-Zone Order
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-semibold leading-relaxed px-2">
              Heads up! Your order contains items from different delivery zones. 
              <span className="block mt-2 text-primary font-bold">
                Extra delivery charges will be applied based on the fulfillment distance.
              </span>
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="sm:flex-col gap-3 mt-8">
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="w-full h-16 rounded-2xl bg-foreground hover:bg-foreground/90 text-white font-black text-lg shadow-xl shadow-black/10 transition-all active:scale-[0.98]"
          >
            I Understand
          </AlertDialogAction>
        </AlertDialogFooter>

        {/* Decorative elements */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
      </AlertDialogContent>
    </AlertDialog>
  );
}
