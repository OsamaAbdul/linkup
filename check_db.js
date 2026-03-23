import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://oljhcvpwulxifdxmcerc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik";
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'd4698584-3927-40a3-9db1-d53b7e2f35ac';

async function check() {
    process.stdout.write(`Checking records for user_id: ${userId}\n`);
    
    try {
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId);
        process.stdout.write(`Profiles: ${JSON.stringify(profiles)} ${pError?.message || ''}\n`);

        const { data: kyc, error: kError } = await supabase
            .from('logistics_kyc')
            .select('*')
            .eq('user_id', userId);
        process.stdout.write(`Logistics KYC: ${JSON.stringify(kyc)} ${kError?.message || ''}\n`);

        const { data: profilesById } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId);
        process.stdout.write(`Profiles (by primary key id): ${JSON.stringify(profilesById)}\n`);

        const { data: authUser, error: aError } = await supabase.auth.admin.getUserById(userId);
        process.stdout.write(`Auth User Status: ${authUser ? 'Found' : 'Not Found'} ${aError?.message || ''}\n`);

    } catch (e) {
        process.stdout.write(`Error: ${e.message}\n`);
    }
}

check();
