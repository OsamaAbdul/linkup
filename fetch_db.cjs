const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let supabaseUrl = '', supabaseKey = '';
for (const line of env) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("COLUMNS:", Object.keys(data[0] || {}));
}
check();
