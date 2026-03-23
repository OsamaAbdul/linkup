import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { toast } from "sonner";
import { Copy, Share2, Facebook, Twitter, MessageSquare } from "lucide-react";

interface PromoteActionProps {
  productId: string;
  productTitle: string;
  promoterCode: string;
}

export function PromoteAction({ productId, productTitle, promoterCode }: PromoteActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const referralLink = `${window.location.origin}/product/${productId}?ref=${promoterCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied to clipboard!");
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`Check out this product: ${productTitle} ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(`Check out this product: ${productTitle}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralLink)}`, "_blank");
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 size={14} /> Promote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote {productTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Input
              value={referralLink}
              readOnly
              className="flex-1 text-xs"
            />
            <Button size="sm" onClick={copyToClipboard} className="px-3">
              <Copy size={14} />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" className="flex-col gap-2 h-auto py-3" onClick={shareOnWhatsApp}>
              <MessageSquare className="text-green-500" size={20} />
              <span className="text-[10px]">WhatsApp</span>
            </Button>
            <Button variant="outline" className="flex-col gap-2 h-auto py-3" onClick={shareOnTwitter}>
              <Twitter className="text-blue-400" size={20} />
              <span className="text-[10px]">Twitter</span>
            </Button>
            <Button variant="outline" className="flex-col gap-2 h-auto py-3" onClick={shareOnFacebook}>
              <Facebook className="text-blue-600" size={20} />
              <span className="text-[10px]">Facebook</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
