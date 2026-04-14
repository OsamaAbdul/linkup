import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REFERRAL_KEY = "linkup_ref";
const REFERRAL_EXPIRY_KEY = "linkup_ref_expiry";
const VISITOR_ID_KEY = "linkup_visitor_id";
const TRACKING_DAYS = 7;

export function useReferral() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (!refCode) return;

    // Last Click Wins: always overwrite
    const expiry = Date.now() + TRACKING_DAYS * 24 * 60 * 60 * 1000;
    
    // Ensure we have a persistent visitor_id
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }

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
          const { data: { user } } = await supabase.auth.getUser();

          // Try to find a matching campaign for this product and promoter
          let campaignId = null;
          if (productId) {
            const { data: campaign } = await supabase
              .from("promoter_campaigns")
              .select("id")
              .eq("product_id", productId)
              .eq("seller_id", codeRow.user_id)
              .eq("is_active", true)
              .maybeSingle();
            campaignId = campaign?.id;
          }

          // Insert into 'referrals' (not referral_clicks)
          await supabase.from("referrals").insert({
            promoter_id: codeRow.user_id,
            product_id: productId || null,
            campaign_id: campaignId,
            visitor_id: visitorId,
            buyer_id: user?.id || null,
            status: 'click'
          });
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

/** Get the stored promoter attribution info if referral is still valid */
export async function getReferralAttribution(): Promise<{ promoter_id: string | null; visitor_id: string | null }> {
  const code = localStorage.getItem(REFERRAL_KEY);
  const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);
  const visitorId = localStorage.getItem(VISITOR_ID_KEY);

  if (!code || !expiry) return { promoter_id: null, visitor_id: visitorId };
  
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(REFERRAL_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    return { promoter_id: null, visitor_id: visitorId };
  }

  const { data } = await supabase
    .from("promoter_codes")
    .select("user_id")
    .eq("code", code)
    .maybeSingle();

  return { 
    promoter_id: data?.user_id ?? null, 
    visitor_id: visitorId 
  };
}
