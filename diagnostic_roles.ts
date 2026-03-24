import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://oljhcvpwulxifdxmcerc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik');

async function diagnostic() {
    console.log("Checking user_roles columns...");
    const { data: d1, error: e1 } = await supabase.from('user_roles').select('*').limit(1);
    if (e1) {
        console.log("Error selecting from user_roles:", e1.message);
    } else {
        console.log("user_roles sample:", JSON.stringify(d1?.[0], null, 2));
    }

    console.log("Checking profiles columns...");
    const { data: d2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
    if (e2) {
        console.log("Error selecting from profiles:", e2.message);
    } else {
        console.log("profiles sample:", JSON.stringify(d2?.[0], null, 2));
    }
}

diagnostic();
