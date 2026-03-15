import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentCard, LogisticsAgent } from "./AgentCard";

interface AgentListProps {
    isLoading: boolean;
    agents: LogisticsAgent[];
    selectedAgentId: string | null;
    onSelectAgent: (id: string) => void;
    onResetZone: () => void;
    showResetZone?: boolean;
}

export const AgentList: React.FC<AgentListProps> = ({
    isLoading,
    agents,
    selectedAgentId,
    onSelectAgent,
    onResetZone,
    showResetZone,
}) => {
    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20 space-y-4"
                    >
                        <div className="relative">
                            <Loader2
                                className="animate-spin text-primary"
                                size={40}
                                strokeWidth={3}
                            />
                            <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full animate-pulse" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                            Syncing Network...
                        </p>
                    </motion.div>
                ) : agents.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <div className="w-24 h-24 rounded-[3rem] bg-muted/30 flex items-center justify-center mb-6">
                            <User className="text-muted-foreground/20" size={48} />
                        </div>
                        <div className="space-y-2 mb-8">
                            <h3 className="font-bold text-foreground text-lg">
                                No Agents Available
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mx-auto">
                                We couldn't find any registered partners in this zone at the
                                moment.
                            </p>
                        </div>
                        {showResetZone && (
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={onResetZone}
                                className="rounded-2xl px-8 h-12 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all ring-offset-background active:scale-95"
                            >
                                Try All Zones
                            </Button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid gap-4"
                    >
                        {agents.map((agent, index) => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                index={index}
                                isSelected={selectedAgentId === agent.id}
                                onSelect={onSelectAgent}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
