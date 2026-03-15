import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PickupPointInputProps {
    value: string;
    onChange: (value: string) => void;
}

export const PickupPointInput: React.FC<PickupPointInputProps> = ({ value, onChange }) => {
    return (
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                Product Pickup Point
            </Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Specify where the agent should pick up the product"
                className="rounded-2xl border-primary/10 focus:border-primary/30 bg-primary/[0.02]"
            />
            <p className="text-[9px] text-muted-foreground font-medium italic">
                This address will only be visible to you and the assigned agent.
            </p>
        </div>
    );
};
