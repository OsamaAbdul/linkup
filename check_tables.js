import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://oljhcvpwulxifdxmcerc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik";
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // We can't easily list tables via supabase-js without RPC or management API,
    // but we can try common names.
    const { data: vt, error: vte } = await supabase.from("vehicle_types").select("*").limit(1);
    process.stdout.write("Vehicle Types Table: " + (vte ? "Not Found" : "Found") + "\n");
    if (!vte) process.stdout.write("Sample: " + JSON.stringify(vt) + "\n");
}
listTables();
