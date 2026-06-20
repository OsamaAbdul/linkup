const fs = require('fs');
const file = 'supabase/migrations/20260101000000_initial_schema.sql';
let content = fs.readFileSync(file);
if (content[0] === 0xff && content[1] === 0xfe) {
  console.log("UTF-16LE detected, converting to UTF-8...");
  content = fs.readFileSync(file, 'utf16le');
  fs.writeFileSync(file, content, 'utf8');
  console.log("Done.");
} else {
  console.log("Not UTF-16LE.");
}
