import React from 'react';
import { Phone, MessageSquare, Star, ShieldCheck, UserCheck, Bike, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';

interface RiderCardProps {
  riderName?: string | null;
  riderPhone?: string | null;
  riderAvatar?: string | null;
  riderVehicle?: string | null;
  status: string;
}

export function RiderContactCard({
  riderName,
  riderPhone,
  riderAvatar,
  riderVehicle,
  status,
}: RiderCardProps) {
  // If rider not assigned yet
  if (!riderName) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center animate-spin duration-1000">
          <Search className="w-5 h-5" />
        </div>
        <h4 className="text-xs font-bold text-foreground font-heading">Matching Closest Rider</h4>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
          We are notifying nearby vetted dispatch riders. Rider details and direct contact will appear here immediately upon acceptance.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border/70 shadow-sm overflow-hidden bg-card">
      <CardContent className="p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Logistics Partner</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            Assigned
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-primary/20 shadow-sm">
            {riderAvatar ? <AvatarImage src={riderAvatar} alt={riderName} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold font-heading text-sm">
              {riderName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold font-heading text-foreground truncate">{riderName}</h4>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Star className="w-3 h-3 fill-amber-500" /> 4.9
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 truncate">
                <Bike className="w-3 h-3" /> {riderVehicle || 'Motorcycle Dispatch'}
              </span>
            </div>
          </div>
        </div>

        {/* Contact actions */}
        {riderPhone && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t">
            <Button
              asChild
              size="sm"
              className="h-9 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <a href={`tel:${riderPhone}`}>
                <Phone className="w-3.5 h-3.5" />
                <span>Call Rider</span>
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 text-xs font-semibold rounded-xl gap-1.5 hover:border-primary"
            >
              <a href={`sms:${riderPhone}`}>
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>SMS Rider</span>
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
