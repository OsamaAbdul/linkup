import * as React from "react";
import { cn } from "@/lib/utils";
import { Landmark } from "lucide-react";
import logo from "@/assets/logo.png";

// --- SVG Icons ---

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);


// --- Helper Components ---

const DashedLine = () => (
  <div
    className="w-full border-t-2 border-dashed border-border"
    aria-hidden="true"
  />
);

const Barcode = ({ value }: { value: string }) => {
    const hashCode = (s: string) => s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const seed = hashCode(value);
    const random = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const bars = Array.from({ length: 60 }).map((_, index) => {
        const rand = random(seed + index);
        const width = rand > 0.7 ? 2.5 : 1.5;
        return { width };
    });

    const spacing = 1.5;
    const totalWidth = bars.reduce((acc, bar) => acc + bar.width + spacing, 0) - spacing;
    const svgWidth = 250;
    const svgHeight = 70;
    let currentX = (svgWidth - totalWidth) / 2;

    return (
        <div className="flex flex-col items-center py-2">
             <svg
                xmlns="http://www.w3.org/2000/svg"
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                aria-label={`Barcode for value ${value}`}
                className="fill-current text-foreground"
            >
                {bars.map((bar, index) => {
                    const x = currentX;
                    currentX += bar.width + spacing;
                    return (
                        <rect
                            key={index}
                            x={x}
                            y="10"
                            width={bar.width}
                            height="50"
                        />
                    );
                })}
            </svg>
            <p className="text-sm text-muted-foreground tracking-[0.3em] mt-2">{value}</p>
        </div>
    );
};

const ConfettiExplosion = () => {
  const confettiCount = 100;
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#f97316"];

  return (
    <>
      <style>
        {`
          @keyframes fall {
            0% {
                transform: translateY(-10vh) rotate(0deg);
                opacity: 1;
            }
            100% {
              transform: translateY(110vh) rotate(720deg);
              opacity: 0;
            }
          }
        `}
      </style>
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        {Array.from({ length: confettiCount }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-4"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${-20 + Math.random() * 10}%`,
              backgroundColor: colors[i % colors.length],
              transform: `rotate(${Math.random() * 360}deg)`,
              animation: `fall ${2.5 + Math.random() * 2.5}s ${Math.random() * 2}s linear forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
};


// --- Main Ticket Component ---

export interface TicketProps extends React.HTMLAttributes<HTMLDivElement> {
  ticketId: string;
  amount: number;
  date: Date;
  cardHolder: string;
  last4Digits: string;
  barcodeValue: string;
  icon?: React.ReactNode;
}

const AnimatedTicket = React.forwardRef<HTMLDivElement, TicketProps>(
  (
    {
      className,
      ticketId,
      amount,
      date,
      cardHolder,
      last4Digits,
      barcodeValue,
      ...props
    },
    ref
  ) => {
    const [showConfetti, setShowConfetti] = React.useState(false);

    React.useEffect(() => {
      const mountTimer = setTimeout(() => setShowConfetti(true), 100);
      const unmountTimer = setTimeout(() => setShowConfetti(false), 6000);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(unmountTimer);
      };
    }, []);

    const fee = 200;
    const netAmount = Math.max(0, amount - fee);

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(netAmount);

    const formattedDate = new Intl.DateTimeFormat("en-GB", {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).replace(',', ' •');

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
        <div
          ref={ref}
          className={cn(
            "relative w-full max-w-sm bg-card text-card-foreground rounded-2xl shadow-lg font-sans z-10",
            "animate-in fade-in-0 zoom-in-95 duration-500",
            className
          )}
          {...props}
        >
          {/* Watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none select-none z-0">
              <img src={logo} alt="Watermark" className="w-64 grayscale" />
          </div>

          {/* Ticket cut-out effect */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background" />
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background" />

          <div className="p-8 flex flex-col items-center text-center bg-[#E96F28] rounded-t-2xl text-white">
              <div className="p-3 bg-white/20 rounded-full animate-in zoom-in-50 delay-300 duration-500">
                  <CheckCircleIcon className="w-10 h-10 text-white animate-in zoom-in-75 delay-500 duration-500" />
              </div>
              <h1 className="text-2xl font-black mt-4 tracking-tight">Withdrawal Confirmed</h1>
              <p className="text-orange-100 mt-1 text-sm font-medium">
                Funds are on the way to your bank account
              </p>
          </div>

          <div className="px-8 pb-8 space-y-6 pt-6">

              <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                      <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-black">Requested Amount</p>
                      <p className="font-bold text-foreground">₦ {amount.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-black/[0.04] pb-3">
                      <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-black">Platform Fee</p>
                      <p className="font-bold text-red-500">- ₦ {fee.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                      <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-black text-[#E96F28]">Net Payout</p>
                      <p className="font-black text-2xl tracking-tighter text-[#E96F28]">{formattedAmount}</p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                      <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-60">Reference ID</p>
                      <p className="font-mono font-bold text-xs mt-1 truncate">{ticketId}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-60">Date & Time</p>
                      <p className="font-bold text-xs mt-1">{formattedDate}</p>
                  </div>
              </div>

              <div className="bg-orange-50/50 p-4 border border-orange-100/50 rounded-2xl flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#E96F28] flex items-center justify-center text-white shadow-md shadow-orange-600/20 shrink-0">
                      <Landmark className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                      <p className="font-black text-sm tracking-tight truncate">{cardHolder}</p>
                      <p className="text-muted-foreground font-mono text-xs tracking-wider mt-0.5 truncate uppercase">ACCT •••• {last4Digits}</p>
                  </div>
              </div>

              <DashedLine />

              <Barcode value={barcodeValue} />
          </div>
        </div>
      </>
    );
  }
);

AnimatedTicket.displayName = "AnimatedTicket";

export { AnimatedTicket };
