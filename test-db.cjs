const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://drvoljuaqmehmpbylcqs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYxNzA2NCwiZXhwIjoyMDk3MTkzMDY0fQ.2iCwtOv2TQVZZNR8ROxtl35QsOVX2nboMWMzEkiuCIs'
);

async function checkConstraint() {
  const { data, error } = await supabase.from('orders').insert({
    buyer_id: '563938ae-f8df-44e3-b646-ea731bff2ad3',
    seller_id: 'b5cd0e65-ee98-433e-b837-4ab3dee64bf5',
    total: 100,
    subtotal: 100,
    shipping_fee: 0,
    platform_fee: 0,
    promoter_fee: 0,
    grand_total: 100,
    status: 'pending',
    promoter_id: null,
    payment_method: null,
    payment_ref: null,
    payment_status: null
  }).select();

  console.log('Insert Result:', data, error);
}

checkConstraint();
