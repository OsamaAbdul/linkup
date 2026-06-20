const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const serviceKeyMatch = envFile.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch[1].trim();
const supabaseKey = (serviceKeyMatch ? serviceKeyMatch[1] : supabaseKeyMatch[1]).trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) console.error(error);
    else console.log("Profiles columns:", Object.keys(data[0] || {}));
}

check();
