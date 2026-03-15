import { useCallback } from "react";
import { loadPaystackInlineScript } from "@/lib/paystack";

type PaystackMetadata = Record<string, unknown> | undefined;

export type PaystackPayArgs = {
  publicKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: PaystackMetadata;
};

export function usePaystackInline() {
  const pay = useCallback(async (args: PaystackPayArgs) => {
    await loadPaystackInlineScript();

    if (!window.PaystackPop?.setup) {
      throw new Error("Paystack is not available");
    }

    return await new Promise<{ reference: string }>((resolve, reject) => {
      const handler = window.PaystackPop!.setup({
        key: args.publicKey,
        email: args.email,
        amount: args.amountKobo,
        ref: args.reference,
        metadata: args.metadata,
        callback: (resp: any) => {
          const reference = resp?.reference;
          if (!reference) return reject(new Error("Missing Paystack reference"));
          resolve({ reference });
        },
        onClose: () => reject(new Error("Payment cancelled")),
      });

      handler.openIframe();
    });
  }, []);

  return { pay };
}
