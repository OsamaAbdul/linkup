const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8').split('\n');
let supabaseUrl, supabaseKey;
for (const line of envFile) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // 1. Get a user
    const { data: profile } = await supabase.from('profiles').select('id, city_id').limit(1).single();
    if (!profile) return console.error("No profile");
    
    // 2. Get a zone
    const { data: zone } = await supabase.from('delivery_zones').select('id').eq('city_id', profile.city_id).limit(1).single();
    if (!zone) return console.error("No zone");

    console.log("Updating profile", profile.id, "with zone", zone.id);
    
    // 3. Update profile
    const { error } = await supabase.from('profiles').update({ zone_id: zone.id }).eq('id', profile.id);
    if (error) return console.error("Update error:", error);

    // 4. Read back
    const { data: updated } = await supabase.from('profiles').select('id, zone_id').eq('id', profile.id).single();
    console.log("Updated profile:", updated);
}

check();
