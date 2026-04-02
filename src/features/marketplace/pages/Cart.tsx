import React, { useState } from 'react';
import { useCart } from "@/features/marketplace/context/CartContext";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Separator } from "@/shared/components/ui/separator";
import {
  Minus, Plus, Trash2, Heart, Store,
  ShieldCheck, Truck, RotateCcw, ChevronRight
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

export default function Cart() {
  const { user } = useAuth();
  const { cartItems, isLoading, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState("");

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item: any) => sum + (item.products?.price ?? 0) * item.quantity, 0);
  const discount = 0;
  const delivery = 0; // Calculated at checkout based on zone
  const total = subtotal - discount;

  const handleCheckout = () => {
    if (!user) {
      toast.info("Please sign in to complete your purchase");
      navigate("/auth?redirect=/checkout");
      return;
    }
    navigate("/checkout");
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cart</h1>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => clearCart()}
            disabled={cartItems.length === 0 || isLoading}
          >
            Clear Cart ›
          </Button>
        </div>

        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-dashed">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck size={16} />
            <span>Your items are verified. {cartItems.length} Items.</span>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Cart Items Column */}
          <div className="flex-1 space-y-4">
            <div className="bg-card rounded-xl border p-4">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-4 p-4 bg-muted/30 rounded-xl animate-pulse">
                          <div className="w-24 h-24 rounded-lg bg-muted" />
                          <div className="flex-1 space-y-3 py-1">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-6 bg-muted rounded w-1/4" />
                          <div className="h-8 bg-muted rounded w-1/2 mt-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">Your cart is empty</p>
                    <Link to="/">
                      <Button>Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  cartItems.map((item: any) => (
                    <div key={item.id || item.product_id} className="flex gap-4 p-4 bg-surface rounded-xl relative group">
                      <div className="w-24 h-24 rounded-lg bg-card p-2 flex-shrink-0">
                        {item.products?.images?.[0] && (
                          <img src={item.products.images[0]} className="w-full h-full object-contain" alt={item.products.title} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground line-clamp-2 sm:line-clamp-1">{item.products?.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="font-bold text-lg">NGN {item.products?.price?.toLocaleString()}</p>
                              {item.size && (
                                <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-muted-foreground/10">
                                  Size: {item.size}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center border rounded-lg bg-card h-8">
                            <button
                              aria-label="Decrease quantity"
                              className="w-8 h-full flex items-center justify-center hover:bg-muted text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.size)}
                            >
                              {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                            </button>
                            <div className="w-8 h-full flex items-center justify-center font-medium text-sm border-x">
                              {item.quantity}
                            </div>
                            <button
                              aria-label="Increase quantity"
                              className="w-8 h-full flex items-center justify-center hover:bg-muted text-muted-foreground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => {
                                const stock = item.products?.inventory || 0;
                                if (item.quantity >= stock) {
                                  toast.error(`Only ${stock} items available`);
                                  return;
                                }
                                updateQuantity(item.product_id, item.quantity + 1, item.size);
                              }}
                              disabled={item.quantity >= (item.products?.inventory || 0)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1 mt-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-primary font-medium"><Store size={12} /> {item.products?.profiles?.display_name || "TechPlanet"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-dashed sm:border-none sm:pt-0">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/20 transition-all active:scale-95">
                              <Heart size={14} />
                              <span className="hidden sm:inline">Save to Wishlist</span>
                              <span className="sm:hidden text-[10px]">Wishlist</span>
                            </Button>
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" onClick={() => removeFromCart(item.product_id, item.size)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Order Summary Column */}
          {cartItems.length > 0 && (
            <div className="w-full lg:w-96 space-y-6">
              <div className="bg-card rounded-xl border p-6 space-y-6">
                <h2 className="font-semibold text-lg">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">NGN {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-NGN {discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Delivery</span>
                    <span className="font-medium text-muted-foreground italic text-xs">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Free Returns <span className="text-amber-500">✨</span>
                    </span>
                    <div className="flex gap-2 text-muted-foreground">
                      <Truck size={16} />
                      <RotateCcw size={16} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-xl">NGN {total.toLocaleString()}</span>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Est. Delivery: 1 - 3 Days</p>
                  <p>Returns accepted up to 2 days</p>
                </div>

                <Button className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg" onClick={handleCheckout}>
                  {user ? "Proceed to Checkout" : "Login to Checkout"}
                </Button>
              </div>

              {/* Coupon Code */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <p className="text-sm font-medium">Have a coupon code?</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code..."
                    className="bg-muted/30 border-dashed"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <Button variant="secondary" className="bg-success/10 text-success hover:bg-success/20">Apply</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Escrow Banner */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-primary">
          <ShieldCheck className="text-warning fill-warning/20" size={20} />
          <span className="font-bold">Escrow Safe</span>
          <span className="text-primary/60">✓</span>
          Only pay when you receive your items.
        </div>

        {/* Mobile Floating Action */}
        {cartItems.length > 0 && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 p-4 bg-card border-t shadow-lg z-40">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-lg">Total</span>
              <span className="font-bold text-xl">NGN {total.toLocaleString()}</span>
            </div>
            <Button className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg" onClick={handleCheckout}>
              {user ? "Proceed to Checkout" : "Login to Checkout"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
