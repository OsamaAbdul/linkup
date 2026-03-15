import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REFERRAL_KEY = "linkup_ref";
const REFERRAL_EXPIRY_KEY = "linkup_ref_expiry";
const TRACKING_DAYS = 7;

export function useReferral() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (!refCode) return;

    // Last Click Wins: always overwrite
    const expiry = Date.now() + TRACKING_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(REFERRAL_KEY, refCode);
    localStorage.setItem(REFERRAL_EXPIRY_KEY, String(expiry));

    // Log the click for analytics
    (async () => {
      try {
        const { data: codeRow } = await supabase
          .from("promoter_codes")
          .select("user_id")
          .eq("code", refCode)
          .maybeSingle();

        if (codeRow) {
          const productId = window.location.pathname.match(/\/product\/([^/?]+)/)?.[1];
          if (productId) {
            await supabase.from("referral_clicks").insert({
              promoter_id: codeRow.user_id,
              product_id: productId,
              visitor_id: crypto.randomUUID(),
            });
          }
        }
      } catch (e) {
        console.error("Referral click log error:", e);
      }
    })();

    // Clean ref from URL without reload
    searchParams.delete("ref");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);
}

/** Get the stored promoter_id if referral is still valid */
export async function getStoredPromoterId(): Promise<string | null> {
  const code = localStorage.getItem(REFERRAL_KEY);
  const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);

  if (!code || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(REFERRAL_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    return null;
  }

  const { data } = await supabase
    .from("promoter_codes")
    .select("user_id")
    .eq("code", code)
    .maybeSingle();

  return data?.user_id ?? null;
}
