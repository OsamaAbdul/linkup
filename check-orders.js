import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://drvoljuaqmehmpbylcqs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYxNzA2NCwiZXhwIjoyMDk3MTkzMDY0fQ.2iCwtOv2TQVZZNR8ROxtl35QsOVX2nboMWMzEkiuCIs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    console.log("Checking orders...");
    
    const { data: allOrders, error: err1 } = await supabase.from('orders').select('id');
    console.log("Total orders via service role:", allOrders?.length);

    const { data: adminTrackerQuery, error: err2 } = await supabase
        .from("orders")
        .select(`
            id,
            buyer_id,
            profiles:buyer_id(display_name, id),
            order_recipient!inner(full_name, phone, address_line, city_id, zone_id, lat, lng),
            shipments(id)
        `);
        
    console.log("AdminTracker query returned:", adminTrackerQuery?.length);
    if (err2) {
        console.error("AdminTracker query error:", err2);
    }
    
    const { data: adminTrackerQueryLeft, error: err3 } = await supabase
        .from("orders")
        .select(`
            id,
            buyer_id,
            profiles:buyer_id(display_name, id),
            order_recipient(full_name, phone, address_line, city_id, zone_id, lat, lng),
            shipments(id)
        `);
        
    console.log("AdminTracker query (left join) returned:", adminTrackerQueryLeft?.length);
    if (err3) {
        console.error("AdminTracker query (left) error:", err3);
    }

}

checkOrders();
