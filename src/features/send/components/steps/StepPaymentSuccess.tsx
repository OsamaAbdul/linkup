import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  Check,
  Copy,
  Search,
  Box,
  Truck,
  CheckCircle2,
  Headphones,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { toast } from 'sonner';
import { SendSupportModal } from '../support/SendSupportModal';

interface SuccessProps {
  orderId: string;
  formData: SendOrderFormData;
}

export function StepPaymentSuccess({ orderId, formData }: SuccessProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const nextSteps = [
    {
      icon: Search,
      title: 'Finding a rider',
      desc: "We're searching for the best rider near you.",
      active: true,
    },
    {
      icon: Box,
      title: 'Rider assigned',
      desc: "We'll notify you once a rider accepts.",
      active: false,
    },
    {
      icon: Box,
      title: 'Pick up',
      desc: 'Rider will come to pick up your package.',
      active: false,
    },
    {
      icon: Truck,
      title: 'On the way',
      desc: 'Your package is on the way to the recipient.',
      active: false,
    },
    {
      icon: CheckCircle2,
      title: 'Delivered',
      desc: 'Package delivered successfully.',
      active: false,
    },
  ];

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-24 text-center max-w-lg mx-auto"
    >
      {/* Green Checkmark Badge with Confetti dots */}
      <div className="relative inline-flex items-center justify-center pt-2">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shadow-inner">
          <Check className="w-10 h-10 stroke-[3.5]" />
        </div>
        {/* Confetti decorative dots */}
        <span className="absolute -top-1 left-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        <span className="absolute top-2 right-1 w-2.5 h-2.5 rounded-full bg-pink-400" />
        <span className="absolute bottom-1 -left-2 w-2 h-2 rounded-full bg-blue-400" />
        <span className="absolute -bottom-2 right-3 w-3 h-3 rounded-full bg-emerald-400" />
        <span className="absolute top-10 -right-4 w-1.5 h-1.5 rounded-full bg-purple-400" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-foreground">
          Payment Successful!
        </h2>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Your package has been placed successfully. We're finding the best rider for you.
        </p>
      </div>

      {/* Light Green Order ID Box matching screenshot */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
        <span className="text-[11px] font-semibold text-muted-foreground block">Order ID</span>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-base sm:text-lg font-extrabold text-emerald-700 select-all">
            {orderId}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-emerald-700 hover:text-emerald-800 transition-colors"
            title="Copy Order ID"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* "What happens next?" Stepper */}
      <div className="text-left space-y-3">
        <h3 className="text-xs font-bold font-heading text-foreground">What happens next?</h3>

        <div className="grid grid-cols-5 gap-1.5">
          {nextSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="text-center space-y-1.5">
                <div
                  className={`w-9 h-9 rounded-full mx-auto flex items-center justify-center transition-all ${
                    step.active
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-muted/60 text-muted-foreground border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p
                    className={`text-[10px] font-bold leading-tight ${
                      step.active ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-[8.5px] text-muted-foreground leading-tight mt-0.5 hidden sm:block">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Summary Card matching screenshot */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card text-left overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h4 className="text-xs font-bold font-heading text-foreground">Order Summary</h4>
          <button
            type="button"
            onClick={() => navigate(`/send/track/${orderId}`)}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <CardContent className="p-4 space-y-3.5">
          {/* Pickup */}
          <div className="flex items-start gap-2.5">
            <span className="w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-foreground">Pickup Location</p>
              <p className="text-muted-foreground mt-0.5">{formData.pickupAddress}</p>
            </div>
          </div>

          <div className="border-l-2 border-dashed border-muted ml-1.5 h-2 -my-2" />

          {/* Drop-off */}
          <div className="flex items-start gap-2.5">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-foreground">Drop-off Location</p>
              <p className="text-muted-foreground mt-0.5">{formData.dropoffAddress}</p>
            </div>
          </div>

          {/* Package Details + ETA */}
          <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-2 text-xs">
              <span className="w-3.5 h-3.5 text-purple-600 shrink-0">📦</span>
              <div>
                <p className="font-bold text-foreground">Package Details</p>
                <p className="text-muted-foreground text-[11px]">
                  Send a Package • {formData.weightKg <= 2 ? 'Small • Under 2kg' : `${formData.weightKg}kg`}
                </p>
                <p className="text-xs font-semibold text-foreground">{formData.packageContents}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
              <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-emerald-600" /> Estimated Delivery
              </span>
              <span className="text-xs font-bold text-emerald-700">15 - 45 mins</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buttons row: Contact Support & Track My Order */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSupportModalOpen(true)}
          className="h-11 rounded-xl text-xs font-semibold gap-1.5 hover:border-primary"
        >
          <Headphones className="w-3.5 h-3.5 text-primary" />
          <span>Contact Support</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/send/track/${orderId}`)}
          className="h-11 rounded-xl text-xs font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Track My Order</span>
        </Button>
      </div>

      {/* Big Orange Back to Home button */}
      <Button
        type="button"
        size="lg"
        onClick={() => navigate('/')}
        className="w-full h-12 rounded-xl text-sm font-bold shadow-md bg-primary hover:bg-primary/95 text-white"
      >
        Back to Home
      </Button>

      <SendSupportModal
        open={supportModalOpen}
        onOpenChange={setSupportModalOpen}
        orderId={orderId}
      />
    </m.div>
  );
}
