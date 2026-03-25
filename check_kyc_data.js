
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function checkKyc() {
    console.log("Checking logistics_kyc table...");
    const { data, error } = await supabase
        .from('logistics_kyc')
        .select('*')
        .limit(5);
    
    if (error) {
        console.error("Error fetching KYC:", error);
    } else {
        console.log("KYC Sample Data:", JSON.stringify(data, null, 2));
    }

    console.log("\nChecking profiles table for zones...");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, zone, zone_id, city_id')
        .limit(5);
    
    if (pError) {
        console.error("Error fetching profiles:", pError);
    } else {
        console.log("Profiles Sample Data:", JSON.stringify(profiles, null, 2));
    }
}

checkKyc();
