import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { 
  ChevronDown, Store, ShoppingBag, Truck, Megaphone, User, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function RoleSwitcher() {
  const { roles, activeRole, setActiveRole } = useAuth();
  const navigate = useNavigate();

  if (roles.length <= 1) return null;

  const roleConfig: Record<string, { label: string; icon: any; path: string; color: string }> = {
    buyer: { label: "Buyer", icon: ShoppingBag, path: "/", color: "text-primary" },
    seller: { label: "Seller", icon: Store, path: "/dashboard", color: "text-orange-500" },
    logistics: { label: "Rider", icon: Truck, path: "/logistics", color: "text-accent" },
    promoter: { label: "Promoter", icon: Megaphone, path: "/promoter-dashboard", color: "text-purple-500" },
    admin: { label: "Admin", icon: User, path: "/admin", color: "text-red-500" },
  };

  const currentConfig = roleConfig[activeRole || "buyer"] || roleConfig.buyer;

  const handleRoleChange = (role: string) => {
    setActiveRole(role);
    navigate(roleConfig[role].path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-4 rounded-xl border-border/40 gap-2 font-bold transition-all hover:bg-muted"
        >
          <currentConfig.icon size={16} className={currentConfig.color} />
          <span className="text-xs uppercase tracking-wider">{currentConfig.label}</span>
          <ChevronDown size={14} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 glass border-white/10 rounded-xl p-2 mt-2 shadow-2xl">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
          Switch Dashboard
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5 my-1" />
        {roles.map((role) => {
          const config = roleConfig[role];
          if (!config) return null;
          const isActive = activeRole === role;
          
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => handleRoleChange(role)}
              className={cn(
                "cursor-pointer rounded-xl py-2.5 px-3 flex items-center justify-between group",
                isActive ? "bg-primary/5 text-primary" : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-3">
                <config.icon size={16} className={cn("transition-colors", isActive ? config.color : "text-muted-foreground group-hover:text-foreground")} />
                <span className="font-semibold text-sm">{config.label}</span>
              </div>
              {isActive && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

