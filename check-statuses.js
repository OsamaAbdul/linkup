import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://drvoljuaqmehmpbylcqs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYxNzA2NCwiZXhwIjoyMDk3MTkzMDY0fQ.2iCwtOv2TQVZZNR8ROxtl35QsOVX2nboMWMzEkiuCIs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrdersStatus() {
    const { data: allOrders, error } = await supabase.from('orders').select('id, status');
    console.log("All orders and statuses:", allOrders);
    
    if (allOrders) {
        const activeOrders = allOrders.filter(o => !['completed', 'cancelled', 'delivered'].includes(o.status));
        console.log("Active orders count:", activeOrders.length);
    }
}

checkOrdersStatus();
