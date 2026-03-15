// Paystack helpers (frontend)

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

let paystackScriptPromise: Promise<void> | null = null;

export async function loadPaystackInlineScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.PaystackPop?.setup) return;

  if (paystackScriptPromise) return paystackScriptPromise;

  paystackScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.paystack.co/v1/inline.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Paystack script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Paystack script failed to load"));
    document.body.appendChild(script);
  });

  return paystackScriptPromise;
}
