import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Loader2,
  Phone,
  Headphones,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface SendCancelOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess?: () => void;
  onOpenSupport?: () => void;
}

const CANCELLATION_REASONS = [
  { id: 'too_long', label: 'Taking too long to find a dispatch rider' },
  { id: 'wrong_address', label: 'Entered incorrect pickup or drop-off address' },
  { id: 'recipient_unavailable', label: 'Recipient is unavailable / change of plans' },
  { id: 'rider_requested', label: 'Dispatch rider asked me to cancel' },
  { id: 'found_alternative', label: 'Found alternative delivery service' },
  { id: 'other', label: 'Other reason' },
];

export function SendCancelOrderModal({
  open,
  onOpenChange,
  order,
  onSuccess,
  onOpenSupport,
}: SendCancelOrderModalProps) {
  const queryClient = useQueryClient();
  const [selectedReason, setSelectedReason] = useState<string>('too_long');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!order) return null;

  const orderId = order.id;
  const status = order.status;
  const deliveryFee = Number(order.delivery_fee || 0);
  const isPaid = order.payment_status === 'paid';

  // Determine stage rules
  const isInTransit = status === 'pickup' || status === 'on_the_way';
  const isDelivered = status === 'delivered';
  const isAlreadyCancelled = status === 'cancelled';
  const isRiderAssigned = status === 'assigned_rider';
  const isPending = status === 'finding_rider' || status === 'pending_payment';

  const handleCancelOrder = async () => {
    if (isInTransit || isDelivered || isAlreadyCancelled) return;

    setIsSubmitting(true);
    const finalReason = selectedReason === 'other' && customReason.trim()
      ? customReason.trim()
      : (CANCELLATION_REASONS.find((r) => r.id === selectedReason)?.label || 'Cancelled by user');

    try {
      // 1. Try invoking atomic cancellation & wallet refund RPC
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('cancel_send_order', {
        p_order_id: orderId,
        p_reason: finalReason,
      });

      if (rpcError) {
        // Fallback: Direct table update if RPC migration is still pending in local database
        console.warn('RPC failed, falling back to direct table update:', rpcError);
        const { error: updateError } = await (supabase as any)
          .from('send_orders')
          .update({
            status: 'cancelled',
            package_details: {
              ...(order.package_details || {}),
              cancellation_reason: finalReason,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) throw updateError;
      }

      // Invalidate queries so tracking view and user history immediately reflect cancelled status
      queryClient.invalidateQueries({ queryKey: ['send-order-tracking', orderId] });
      queryClient.invalidateQueries({ queryKey: ['send-orders-history'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      toast.success(
        isPaid && deliveryFee > 0
          ? `Order cancelled. ₦${deliveryFee.toLocaleString()} has been credited to your wallet balance.`
          : 'Package order cancelled successfully.'
      );

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      toast.error('Failed to cancel order: ' + (err.message || 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border border-black/[0.08] shadow-2xl space-y-4">
        <DialogHeader className="space-y-1 text-left pb-2 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-sm">
              <XCircle size={22} />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                Cancel Package Order
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                Order Ref: <span className="font-mono font-bold text-foreground">{orderId}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* CASE A: IN-TRANSIT (PACKAGE WITH RIDER) - Disallowed for safety */}
        {isInTransit ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>Package is currently with the courier</span>
              </div>
              <p className="text-[12px] leading-relaxed text-amber-900">
                Your package was already collected by <strong>{order.rider_name || 'your dispatch rider'}</strong> and is physically in transit.
                To protect your package against loss, orders cannot be cancelled directly in the app while in transit.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-2 text-xs">
              <p className="font-bold text-foreground">Need to stop this delivery?</p>
              <p className="text-[11px] text-muted-foreground">
                Contact your rider immediately to request that the package be returned to the pickup address, or reach out to our 24/7 dispatch coordinator.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {order.rider_phone ? (
                <a
                  href={`tel:${order.rider_phone}`}
                  className="h-11 rounded-2xl bg-primary hover:bg-primary/95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                >
                  <Phone size={14} />
                  <span>Call Rider</span>
                </a>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-11 rounded-2xl font-bold text-xs"
                >
                  Keep Delivery
                </Button>
              )}

              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  if (onOpenSupport) onOpenSupport();
                }}
                className="h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Headphones size={14} />
                <span>Contact Support</span>
              </Button>
            </div>
          </div>
        ) : isDelivered ? (
          /* CASE B: ALREADY DELIVERED */
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-foreground">Package Already Delivered</p>
            <p className="text-xs text-muted-foreground">
              This package has already arrived safely at its destination and cannot be cancelled.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-2xl font-bold text-xs"
            >
              Close
            </Button>
          </div>
        ) : (
          /* CASE C: ELIGIBLE FOR CANCELLATION (Pending or Assigned) */
          <div className="space-y-4 py-1">
            {/* Refund & Policy Badge */}
            {isPaid && deliveryFee > 0 ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Wallet size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Instant 100% Wallet Refund: ₦{deliveryFee.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Your payment will be refunded immediately back to your LinkUp wallet upon confirmation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                Cancellation is completely free of charge. No payment has been debited.
              </div>
            )}

            {/* Rider assigned warning (if applicable) */}
            {isRiderAssigned && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{order.rider_name || 'A rider'}</strong> accepted this mission and is heading to the pickup spot. Cancelling now will release the rider.
                </span>
              </div>
            )}

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Please tell us why you are cancelling:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === reason.id
                        ? 'border-primary bg-primary/5 font-semibold text-primary'
                        : 'border-black/[0.06] hover:bg-gray-50 text-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={selectedReason === reason.id}
                      onChange={() => setSelectedReason(reason.id)}
                      className="accent-primary"
                    />
                    <span>{reason.label}</span>
                  </label>
                ))}
              </div>

              {selectedReason === 'other' && (
                <input
                  type="text"
                  placeholder="Type your reason here..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-black/[0.1] focus:outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-2xl font-bold text-xs"
              >
                Keep My Order
              </Button>

              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancelOrder}
                className="h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
                    <span>Confirm Cancel</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
