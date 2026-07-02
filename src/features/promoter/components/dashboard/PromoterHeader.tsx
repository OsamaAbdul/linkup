import { Card, CardContent } from "@/shared/components/ui/card";
import { Wallet, Clock } from "lucide-react";

interface PromoterHeaderProps {
  wallet: any;
}

export function PromoterHeader({ wallet }: PromoterHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Promoter Hub</h1>
        <p className="text-muted-foreground">Manage your promotions, track earnings, and withdraw funds.</p>
      </div>

      <div className="flex gap-4 shrink-0">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-full">
              <Wallet className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Available</p>
              <p className="text-xl font-bold text-primary">₦{wallet?.balance?.toLocaleString() ?? "0"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-amber-500/10 rounded-full">
              <Clock className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">In Escrow</p>
              <p className="text-xl font-bold text-amber-600">₦{wallet?.escrow_balance?.toLocaleString() ?? "0"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
