import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://oljhcvpwulxifdxmcerc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik";
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchTables() {
    const tables = ["vehicle_types", "delivery_vehicles", "vehicle_options", "transport_types"];
    for (const table of tables) {
        const { error } = await supabase.from(table).select("*").limit(1);
        process.stdout.write(`Table ${table}: ${error ? "Not Found" : "Found"}\n`);
    }
}
searchTables();
