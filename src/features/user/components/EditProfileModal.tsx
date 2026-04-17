import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { ProfileForm } from "./ProfileForm";
import { UserCog, ShieldCheck } from "lucide-react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileModal({ open, onOpenChange }: EditProfileModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] rounded-[40px] p-0 overflow-hidden border-none shadow-2xl bg-white flex flex-col">
        <DialogHeader className="bg-primary/5 p-8 pb-6 border-b border-primary/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <UserCog size={24} strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Update Registry
                <ShieldCheck size={18} className="text-primary animate-pulse" />
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                Keep your Linkup identity accurate
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30">
          <div className="p-8">
            <ProfileForm onSuccess={() => onOpenChange(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
