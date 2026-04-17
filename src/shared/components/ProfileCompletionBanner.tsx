import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileCompletionBannerProps {
  onAction?: () => void;
}

export function ProfileCompletionBanner({ onAction }: ProfileCompletionBannerProps) {
  const { profile, loading } = useAuth();

  if (loading || !profile) return null;

  // Strict check for Registry Strength
  const isComplete = 
    profile.display_name && 
    profile.phone && 
    profile.city_id &&
    profile.latitude &&
    profile.longitude &&
    profile.bio;

  if (isComplete) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200/50 rounded-2xl p-4 sm:p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm ring-1 ring-amber-500/5">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0 shadow-inner">
              <AlertCircle size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">Profile Incomplete</h3>
              <p className="text-xs font-bold text-amber-700/80 mt-0.5">Complete your profile to ensure smooth payouts and faster deliveries.</p>
            </div>
          </div>
          
          {onAction ? (
            <Button 
                onClick={onAction}
                className="rounded-xl h-11 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-600/20 transition-all active:scale-95 gap-2"
            >
                Complete Profile
                <ArrowRight size={14} strokeWidth={3} />
            </Button>
          ) : (
            <Button 
                asChild
                className="rounded-xl h-11 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-600/20 transition-all active:scale-95 gap-2"
            >
                <Link to="/profile">
                Complete Profile
                <ArrowRight size={14} strokeWidth={3} />
                </Link>
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
