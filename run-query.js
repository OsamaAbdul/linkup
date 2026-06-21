import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://drvoljuaqmehmpbylcqs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYxNzA2NCwiZXhwIjoyMDk3MTkzMDY0fQ.2iCwtOv2TQVZZNR8ROxtl35QsOVX2nboMWMzEkiuCIs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTrackerQuery() {
    const { data, error } = await supabase
        .from("orders")
        .select(`
            *,
            profiles:buyer_id(display_name, id),
            order_recipient(full_name, phone, address_line, city_id, zone_id, lat, lng),
            shipments(*)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
        
    console.log("Tracker query error:", error);
    console.log("Tracker query length:", data?.length);
    console.log("Tracker query ids:", data?.map(d => d.id));
}

runTrackerQuery();
