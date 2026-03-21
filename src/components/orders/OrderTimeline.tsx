import { CheckCircle2, MoreHorizontal, Truck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTimelineProps {
    status: string;
    shipmentStatus?: string;
}

export function OrderTimeline({ status: rawStatus, shipmentStatus }: OrderTimelineProps) {
    const status = rawStatus.toLowerCase();

    const getStepStatus = (step: string) => {
        if (status === 'cancelled') return 'cancelled';
        if (status === 'refunded' || status === 'disputed') return 'complete';

        const allStatuses = [
            'pending', 
            'confirmed', 
            'awaiting_agent', 
            'accepted', 
            'out_for_pickup', 
            'arrived_at_seller', 
            'picked_up', 
            'out_for_delivery', 
            'arrived_at_destination', 
            'delivered', 
            'completed',
            'refunded',
            'disputed'
        ];
        const currentIdx = allStatuses.indexOf(status);
        
        let targetIdx = 0;
        if (step === 'pending') targetIdx = 0; // pending, confirmed
        else if (step === 'processing') targetIdx = 2; // awaiting_agent, accepted
        else if (step === 'transit') targetIdx = 6; // out_for_pickup -> arrived_at_destination
        else if (step === 'delivered') targetIdx = 9; // delivered, completed

        // Custom logic for the middle steps
        if (step === 'pending' && currentIdx >= 1) return 'complete';
        if (step === 'processing' && currentIdx >= 4) return 'complete';
        if (step === 'transit' && currentIdx >= 9) return 'complete';

        if (currentIdx >= targetIdx) return 'complete';
        if (currentIdx === targetIdx - 1) return 'current';
        return 'upcoming';
    };

    const getDynamicLabel = (stepId: string) => {
        if (status === 'refunded') return 'Refunded';
        if (status === 'disputed') return 'Disputed';
        
        if (stepId === 'processing') {
            if (status === 'awaiting_agent') return 'Finding Agent';
            if (status === 'accepted') return 'Agent Assigned';
            return 'Clearing';
        }
        if (stepId === 'transit') {
            if (status === 'out_for_pickup') return 'To Seller';
            if (status === 'arrived_at_seller') return 'At Seller';
            if (status === 'picked_up') return 'Picked Up';
            if (status === 'out_for_delivery') return 'On the Way';
            if (status === 'arrived_at_destination') return 'Arrived';
            return 'Transit';
        }
        return steps.find(s => s.id === stepId)?.label || '';
    };

    const steps = [
        { id: 'pending', label: 'Logged', icon: CheckCircle2 },
        { id: 'processing', label: 'Processing', icon: MoreHorizontal },
        { id: 'transit', label: 'Transit', icon: Truck },
        { id: 'delivered', label: 'Secured', icon: ShieldCheck }
    ];

    const getProgressWidth = () => {
        const allStatuses = [
            'pending', 'confirmed', 'awaiting_agent', 'accepted', 
            'out_for_pickup', 'arrived_at_seller', 'picked_up', 
            'out_for_delivery', 'arrived_at_destination', 'delivered', 'completed'
        ];
        const idx = allStatuses.indexOf(status);
        if (idx === -1) return '0%';
        return `${((idx + 1) / allStatuses.length) * 100}%`;
    };

    return (
        <div className="relative h-20 flex items-center mb-6">
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),.5)]"
                    style={{ width: getProgressWidth() }}
                />
            </div>

            <div className="relative w-full flex justify-between">
                {steps.map((step, idx) => {
                    const stepStatus = getStepStatus(step.id);
                    return (
                        <div key={idx} className="flex flex-col items-center gap-2.5 w-1/4">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 z-10",
                                stepStatus === 'complete' ? "bg-white border-primary text-primary shadow-lg shadow-primary/10 scale-105" :
                                    stepStatus === 'current' ? "bg-white border-primary text-primary animate-pulse" :
                                        "bg-white border-muted text-muted-foreground/30"
                            )}>
                                <step.icon size={18} strokeWidth={stepStatus === 'complete' ? 3 : 2} />
                            </div>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-[0.15em] transition-colors duration-300",
                                stepStatus === 'complete' ? "text-foreground" : "text-muted-foreground/50"
                            )}>{getDynamicLabel(step.id)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
