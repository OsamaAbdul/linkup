
import { createClient } from '@supabase/supabase-js'

const supabase = createClient("https://oljhcvpwulxifdxmcerc.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik")

async function checkKyc() {
    console.log("Distinct KYC Statuses:");
    const { data: statuses, error: sError } = await supabase
        .from('logistics_kyc')
        .select('status');
    
    if (sError) {
        console.error("Error fetching statuses:", sError);
    } else {
        const distinct = [...new Set(statuses.map(s => s.status))];
        console.log(distinct);
    }

    console.log("\nKYC Data Sample:");
    const { data, error } = await supabase
        .from('logistics_kyc')
        .select('user_id, status, full_name')
        .limit(20);
    
    if (error) {
        console.error("Error fetching KYC:", error);
    } else {
        data.forEach(d => console.log(`User: ${d.user_id}, Status: [${d.status}], Name: ${d.full_name}`));
    }
}

checkKyc();
