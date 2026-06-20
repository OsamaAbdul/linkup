const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[key] = val;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
    const { data: wallet, error } = await supabase.from('wallets').select('*').eq('user_id', 'b3636063-4184-40b0-91ac-2e7b546874e4');
    console.log('Wallet Data:', wallet);
    console.log('Error:', error);
}

run();
