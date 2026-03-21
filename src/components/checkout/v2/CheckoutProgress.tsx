import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutProgressProps {
  currentStep: number;
}

const steps = [
  { id: 1, name: "Delivery" },
  { id: 2, name: "Payment" },
  { id: 3, name: "Confirm" },
];

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  return (
    <div className="w-full py-4 px-4">
      <div className="relative flex justify-between max-w-2xl mx-auto">
        {/* Connection Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0" />
        <motion.div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0"
          initial={{ width: "0%" }}
          animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {steps.map((step) => (
          <div key={step.id} className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={false}
              animate={{
                backgroundColor: currentStep >= step.id ? "var(--primary)" : "var(--background)",
                borderColor: currentStep >= step.id ? "var(--primary)" : "var(--muted-foreground)",
                scale: currentStep === step.id ? 1.2 : 1,
              }}
              className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors duration-300 shadow-xl bg-white",
                currentStep > step.id ? "bg-primary text-white" : "text-muted-foreground"
              )}
            >
              {currentStep > step.id ? (
                <Check size={18} strokeWidth={3} />
              ) : (
                <span className="text-sm font-black">{step.id}</span>
              )}
            </motion.div>
            <span className={cn(
              "absolute -bottom-6 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
              currentStep >= step.id ? "text-primary" : "text-muted-foreground"
            )}>
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
