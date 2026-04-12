import { m } from "framer-motion";
import { MapPin, Shield, Zap } from "lucide-react";

const features = [
  { icon: MapPin, title: "Location-Based", desc: "Discover products near you" },
  { icon: Shield, title: "Verified Sellers", desc: "Trusted local merchants" },
  { icon: Zap, title: "Instant Delivery", desc: "Fast same-day fulfillment" },
];

export const AuthSidebar = () => {
  return (
    <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-primary">
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary-foreground)/0.08)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-10 text-center">
        {/* Hero image */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/20 border border-primary-foreground/10 mb-10">
            <img
              src="/link-up.png"
              alt="Linkup"
              className="w-full h-auto object-cover"
            />
          </div>
        </m.div>

        {/* Tagline */}
        <m.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-3 mb-10"
        >
          <h2 className="text-3xl font-bold text-primary-foreground tracking-tight leading-tight">
            Your Neighbourhood
            <br />
            Marketplace
          </h2>
          <p className="text-primary-foreground/70 text-base leading-relaxed max-w-sm mx-auto">
            Buy and sell within your community. Fast, local, and trusted.
          </p>
        </m.div>

        {/* Feature pills */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col gap-3"
        >
          {features.map((f, i) => (
            <m.div
              key={f.title}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/10"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary-foreground/15 shrink-0">
                <f.icon size={18} className="text-primary-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-primary-foreground">{f.title}</p>
                <p className="text-xs text-primary-foreground/60">{f.desc}</p>
              </div>
            </m.div>
          ))}
        </m.div>
      </div>
    </div>
  );
};

