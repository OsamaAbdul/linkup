const { Client } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let conn = '';
for (const line of env) {
  if (line.startsWith('DATABASE_URL=')) conn = line.split('=')[1].trim();
}

async function check() {
  const client = new Client({ connectionString: conn });
  await client.connect();
  const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['profiles']);
  console.log(res.rows);
  await client.end();
}
check();
