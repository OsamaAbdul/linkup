
import { createClient } from '@supabase/supabase-js'

const supabase = createClient("https://oljhcvpwulxifdxmcerc.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjcvp3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik")

async function checkProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log("Profile Columns:", Object.keys(data[0]));
    }
}

checkProfiles();
