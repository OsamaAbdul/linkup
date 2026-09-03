import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import { Package, Scale, Sparkles, ArrowRight, AlertCircle, Box, Layers, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';

interface Step1Props {
  formData: SendOrderFormData;
  onChange: (data: Partial<SendOrderFormData>) => void;
  onNext: () => void;
}

export function Step1PackageDetails({ formData, onChange, onNext }: Step1Props) {
  const [error, setError] = useState('');

  const packageSizes = [
    { label: 'Small', sub: 'Under 2kg', desc: 'Books, documents, phones', weight: 1.5 },
    { label: 'Medium', sub: '2 - 5kg', desc: 'Shoebox, small electronics', weight: 3.5 },
    { label: 'Large', sub: '5 - 10kg', desc: 'Microwave, clothing batch', weight: 7.5 },
    { label: 'Extra Large', sub: '10kg+', desc: 'Heavy appliances, cartons', weight: 12.0 },
  ];

  const handleNext = () => {
    if (!formData.packageContents.trim()) {
      setError('Please describe what is inside the package');
      return;
    }
    setError('');
    onNext();
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 pb-16"
    >
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-bold font-heading text-foreground">
          Package Details
        </h2>
        <p className="text-xs text-muted-foreground">
          Select the size and specify the contents of your parcel.
        </p>
      </div>

      {/* Package Size Presets */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-xs font-bold font-heading uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-primary" />
            <span>Select Package Size</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {packageSizes.map((size) => {
              const isSelected =
                Math.abs(formData.weightKg - size.weight) < 1.0 ||
                (size.label === 'Small' && formData.weightKg <= 2);

              return (
                <button
                  key={size.label}
                  type="button"
                  onClick={() => onChange({ weightKg: size.weight })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-heading text-foreground">{size.label}</span>
                    <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {size.sub}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{size.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Custom Weight (kg)</span>
              <span className="text-primary font-bold">{formData.weightKg} kg</span>
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={formData.weightKg || ''}
              onChange={(e) => onChange({ weightKg: parseFloat(e.target.value) || 1 })}
              className="mt-1.5 h-9 text-xs"
              placeholder="e.g. 2.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Package Contents */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>What are you sending?</span> <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Books, Laptop in bag, Clothes, Birthday gift"
              value={formData.packageContents}
              onChange={(e) => {
                setError('');
                onChange({ packageContents: e.target.value });
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </p>
            )}
          </div>

          <div className="pt-1 flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Fragile Item</p>
                <p className="text-[10px] text-muted-foreground">Requires extra delicate handling</p>
              </div>
            </div>
            <Checkbox
              checked={formData.isFragile}
              onCheckedChange={(c) => onChange({ isFragile: !!c })}
              className="h-4 w-4"
            />
          </div>
        </CardContent>
      </Card>

      {/* Safe & Secure notice */}
      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          Every parcel is insured and safely tracked from pickup to delivery.
        </span>
      </div>

      {/* Next Button */}
      <Button
        type="button"
        size="lg"
        onClick={handleNext}
        className="w-full h-12 rounded-xl text-sm font-bold shadow-md bg-primary hover:bg-primary/95 text-white gap-2"
      >
        <span>Continue to Pickup Location</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </m.div>
  );
}
