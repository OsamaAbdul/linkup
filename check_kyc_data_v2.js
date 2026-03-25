
import { createClient } from '@supabase/supabase-js'

const supabase = createClient("https://oljhcvpwulxifdxmcerc.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik")

async function checkKyc() {
    console.log("Checking logistics_kyc table...");
    const { data, error } = await supabase
        .from('logistics_kyc')
        .select('*')
        .limit(10);
    
    if (error) {
        console.error("Error fetching KYC:", error);
    } else {
        console.log("KYC Sample Data (Status and User IDs):");
        data?.forEach(d => console.log(`User: ${d.user_id}, Status: ${d.status}, Name: ${d.full_name}`));
    }

    console.log("\nChecking profiles table for zones...");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, zone, zone_id, city_id')
        .limit(10);
    
    if (pError) {
        console.error("Error fetching profiles:", pError);
    } else {
        console.log("Profiles Sample Data:");
        profiles?.forEach(p => console.log(`User: ${p.id}, Zone: ${p.zone}`));
    }
}

checkKyc();
