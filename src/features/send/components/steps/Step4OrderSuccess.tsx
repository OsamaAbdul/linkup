import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  Check,
  Navigation,
  ExternalLink,
  PackageCheck,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Step4Props {
  orderId: string;
  onReset: () => void;
}

export function Step4OrderSuccess({ orderId, onReset }: Step4Props) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    toast.success('Order ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-md mx-auto py-8 px-4 text-center space-y-6"
    >
      {/* Animated Success Badge */}
      <div className="relative inline-flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center animate-in zoom-in-50 duration-500 shadow-inner">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs shadow-md animate-bounce">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-extrabold font-heading text-foreground">Package Order Placed!</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Your delivery request has been broadcasted to our logistics network. A rider is being matched right now.
        </p>
      </div>

      {/* Prominent Order ID Card with Copy Button */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-amber-500/5 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tracking Order ID
            </span>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              Payment Confirmed
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 p-3 bg-background rounded-xl border shadow-inner">
            <span className="font-mono text-base sm:text-lg font-extrabold text-foreground tracking-wide select-all">
              {orderId}
            </span>
            <Button
              type="button"
              variant={copied ? 'default' : 'outline'}
              size="sm"
              onClick={handleCopy}
              className={`h-9 px-3 text-xs gap-1.5 transition-all ${
                copied ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'hover:border-primary'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-primary" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-left flex items-center gap-1.5 pt-1">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Estimated pickup arrival: ~10 - 20 minutes</span>
          </p>
        </CardContent>
      </Card>

      {/* Action CTA Buttons */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          size="lg"
          onClick={() => navigate(`/send/track/${orderId}`)}
          className="w-full h-13 rounded-2xl text-base font-bold shadow-lg bg-primary hover:bg-primary/95 text-white gap-2 transition-all"
        >
          <Navigation className="w-5 h-5" />
          <span>Track Package in Real Time</span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Button>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="h-10 rounded-xl text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Send Another</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/send/history')}
            className="h-10 rounded-xl text-xs font-semibold gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>My Send Orders</span>
          </Button>
        </div>
      </div>
    </m.div>
  );
}
