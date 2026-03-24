import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://oljhcvpwulxifdxmcerc.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik");

async function investigate() {
  const userId = "940dfd9b-d729-459b-a010-86d7734a7810";
  const walletId = "44d2812f-90c3-4b9d-b286-931da7600863"; 
  console.log("User ID:", userId);

  // 1. Get Orders and Sum
  const { data: orders, error: ordersError } = await supabase.from('orders').select('id, total, status, settlement_status').eq('seller_id', userId);
  if (ordersError) {
    console.error("Orders Error:", ordersError);
    return;
  }
  const totalGross = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
  console.log("Total Gross Orders Sum:", totalGross);
  console.log("Order Breakdown:", orders?.map(o => `${o.id.slice(0,8)}: ${o.total} (${o.status}, ${o.settlement_status})`));

  // 2. Get Wallet Balance
  const { data: wallet, error: walletError } = await supabase.from('wallets').select('id, balance').eq('seller_id', userId).maybeSingle();
  if (walletError || !wallet) {
    console.error("Wallet Error or Not Found:", walletError);
    return;
  }
  console.log("Wallet Balance:", wallet.balance);

  // 3. Get Transactions
  const { data: txs, error: txsError } = await supabase.from('wallet_transactions').select('amount, type, description, created_at').eq('wallet_id', wallet.id);
  if (txsError) {
    console.error("Transactions Error:", txsError);
    return;
  }
  console.log("Transactions Count:", txs?.length || 0);
  const totalTxs = txs?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
  console.log("Sum of Transactions:", totalTxs);
  console.log("Transactions:", txs);
}

investigate();
