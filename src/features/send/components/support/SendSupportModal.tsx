import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Headphones,
  Phone,
  MessageSquare,
  LifeBuoy,
  FileText,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SendSupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  orderStatus?: string;
}

export function SendSupportModal({
  open,
  onOpenChange,
  orderId,
  orderStatus,
}: SendSupportModalProps) {
  const navigate = useNavigate();

  // Support phone & WhatsApp link for LinkUp Nigeria
  const supportPhone = '08144445693';
  const supportPhoneTel = '+2348144445693';
  const whatsappUrl = 'https://wa.link/cpb3fe';

  const handleOpenTicket = () => {
    onOpenChange(false);
    navigate('/support', {
      state: {
        category: 'delivery_issues',
        subject: orderId ? `SEND Package Issue (${orderId})` : 'SEND Package Delivery Inquiry',
        description: orderId ? `Inquiry regarding order ref: ${orderId}` : '',
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border border-black/[0.08] shadow-2xl space-y-4">
        <DialogHeader className="space-y-1 text-left pb-2 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100/80 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0 shadow-sm">
              <Headphones size={22} className="text-[#EA580C]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                LinkUp Dispatch Support
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                We're here 24/7 to help you with your package delivery.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Order Reference Pill (if tracked) */}
        {orderId && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50 border border-orange-200/80 text-xs">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-primary" />
              <span className="font-bold text-foreground font-mono">{orderId}</span>
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-white text-orange-800 border border-orange-200">
              {orderStatus?.replace('_', ' ') || 'Active'}
            </span>
          </div>
        )}

        {/* Contact Channels Grid */}
        <div className="space-y-2.5">
          {/* WhatsApp Live Chat (Primary) */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
                💬
              </div>
              <div>
                <p className="font-bold text-foreground text-xs group-hover:text-emerald-800 transition-colors">
                  Chat on WhatsApp
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Instant live response from our dispatch agent
                </p>
              </div>
            </div>
            <ExternalLink size={15} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {/* Direct Phone Helpline */}
          <a
            href={`tel:${supportPhoneTel}`}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
                <Phone size={18} />
              </div>
              <div>
                <p className="font-bold text-foreground text-xs group-hover:text-blue-800 transition-colors">
                  Call Helpline ({supportPhone})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Talk to a dispatch coordinator right away
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-blue-600 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {/* Open In-App Support Ticket */}
          <button
            type="button"
            onClick={handleOpenTicket}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-black/[0.06] bg-gray-50/60 hover:bg-gray-100/60 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold shadow-sm">
                <LifeBuoy size={18} />
              </div>
              <div>
                <p className="font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                  Submit Support Ticket
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Log a complaint, request change, or report an issue
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Operating Hours & Guarantee */}
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>LinkUp Delivery Guarantee</span>
          </div>
          <p>
            All packages are insured against loss or damage. If your rider has not arrived or there is an issue, our dispatch team can reassign or refund your order.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="w-full h-11 rounded-2xl font-bold text-xs"
        >
          Dismiss
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Branded Contact Support Pill Button (matching user's uploaded image)
 */
export function ContactSupportButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3.5 rounded-full bg-[#FFBE1A] hover:bg-[#FFAE00] border-2 border-[#EA580C] text-[#0F172A] font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 ${className || ''}`}
    >
      <Headphones className="w-4 h-4 text-[#EA580C] stroke-[2.5]" />
      <span className="leading-none">Contact Support</span>
    </button>
  );
}
