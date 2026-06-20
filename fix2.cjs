const fs = require('fs');
let file = 'supabase/migrations/20260101000000_initial_schema.sql';
let content = fs.readFileSync(file, 'utf8');

let p = content.indexOf('-- Restore profiles table');
let count = 0;
while(p !== -1) {
  count++;
  console.log(`Found Restore profiles table at ${p}`);
  p = content.indexOf('-- Restore profiles table', p + 1);
}

let sec = content.indexOf('-- 6. SECURITY / RLS');
console.log(`SECURITY RLS is at ${sec}`);
