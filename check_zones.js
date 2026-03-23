import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://oljhcvpwulxifdxmcerc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkZones() {
    const { data, error } = await supabase.from("delivery_zones").select("id, name, city_id");
    process.stdout.write("Delivery Zones: " + JSON.stringify(data, null, 2) + "\n");
}
checkZones();
