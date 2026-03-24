import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://oljhcvpwulxifdxmcerc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik');

async function diagnostic() {
    console.log("Checking payout_requests...");
    const { data: d1, error: e1 } = await supabase.from('payout_requests').select('*').limit(1);
    if (e1) {
        console.log("Error selecting from payout_requests:", e1.message, e1.code);
    } else {
        console.log("Successfully selected from payout_requests. Rows found:", d1?.length);
    }

    console.log("Checking system_settings...");
    const { data: d2, error: e2 } = await supabase.from('system_settings').select('*').limit(1);
    if (e2) {
        console.log("Error selecting from system_settings:", e2.message, e2.code);
    } else {
        console.log("Successfully selected from system_settings. Rows found:", d2?.length);
    }
}

diagnostic();
