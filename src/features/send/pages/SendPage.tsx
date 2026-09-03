import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { SendProgress } from '../components/SendProgress';
import { Step1PackageDetails } from '../components/steps/Step1PackageDetails';
import { Step2PickupLocation } from '../components/steps/Step2PickupLocation';
import { Step3DropoffLocation } from '../components/steps/Step3DropoffLocation';
import { Step4ReviewAndPrice } from '../components/steps/Step4ReviewAndPrice';
import { Step5ConfirmAndPay } from '../components/steps/Step5ConfirmAndPay';
import { StepPaymentSuccess } from '../components/steps/StepPaymentSuccess';
import { SendOrderFormData } from '../schemas/sendOrderSchema';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ArrowLeft, Bell, ShoppingCart } from 'lucide-react';
import { useCart } from '@/features/marketplace/context/CartContext';
import { ContactSupportButton, SendSupportModal } from '../components/support/SendSupportModal';

export default function SendPage() {
  const { user, profile } = useAuth();
  const { totalCount } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string>('');
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState<SendOrderFormData>({
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    pickupLat: null,
    pickupLng: null,
    pickupDirections: '',
    savePickupAddress: false,
    pickupAddressLabel: '',

    dropoffRecipientName: '',
    dropoffRecipientPhone: '',
    dropoffAddress: '',
    dropoffLat: null,
    dropoffLng: null,
    dropoffDirections: '',
    saveDropoffAddress: false,
    dropoffAddressLabel: '',

    weightKg: 1.5,
    packageContents: '',
    isFragile: false,
  });

  // Prefill sender details from authenticated profile if available
  useEffect(() => {
    if (profile || user) {
      const p = profile as any;
      setFormData((prev) => ({
        ...prev,
        senderName: prev.senderName || p?.name || p?.full_name || user?.user_metadata?.full_name || '',
        senderPhone: prev.senderPhone || p?.phone || user?.phone || '',
      }));
    }
  }, [profile, user]);

  const updateFormData = (updates: Partial<SendOrderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handlePaymentSuccess = (orderId: string) => {
    setConfirmedOrderId(orderId);
    setStep(6);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // const userInitial = (user?.email || profile?.name || 'U')[0].toUpperCase();

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-3 sm:py-5">
        {/* Top Header matching screenshots */}
        {step <= 5 && (
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step > 1) {
                    setStep((prev) => (prev - 1) as any);
                  } else {
                    navigate('/');
                  }
                }}
                className="p-1 rounded-full hover:bg-muted transition-colors text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold font-heading text-foreground">
                  Send a Package
                </h1>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Send boxes, items, parcels etc.
                </p>
              </div>
            </div>

            {/* Contact Support Pill Button */}
            <ContactSupportButton onClick={() => setSupportModalOpen(true)} />
          </div>
        )}

        {/* 5-Step Stepper matching screenshots */}
        {step <= 5 && <SendProgress currentStep={step} />}

        {/* Dynamic Step Wizard */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step1PackageDetails
              key="step1"
              formData={formData}
              onChange={updateFormData}
              onNext={() => {
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {step === 2 && (
            <Step2PickupLocation
              key="step2"
              formData={formData}
              onChange={updateFormData}
              onNext={() => {
                setStep(3);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <Step3DropoffLocation
              key="step3"
              formData={formData}
              onChange={updateFormData}
              onNext={() => {
                setStep(4);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <Step4ReviewAndPrice
              key="step4"
              formData={formData}
              onGoToStep={(stepNumber) => setStep(stepNumber as any)}
              onNext={() => {
                setStep(5);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onBack={() => setStep(3)}
            />
          )}

          {step === 5 && (
            <Step5ConfirmAndPay
              key="step5"
              formData={formData}
              onEdit={() => setStep(4)}
              onPaymentSuccess={handlePaymentSuccess}
              onBack={() => setStep(4)}
            />
          )}

          {step === 6 && (
            <StepPaymentSuccess
              key="step6"
              orderId={confirmedOrderId}
              formData={formData}
            />
          )}
        </AnimatePresence>

        <SendSupportModal
          open={supportModalOpen}
          onOpenChange={setSupportModalOpen}
          orderId={confirmedOrderId}
        />
      </div>
    </AppLayout>
  );
}
