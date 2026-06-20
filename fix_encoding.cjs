const fs = require('fs');
const content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf16le');
fs.writeFileSync('src/integrations/supabase/types.ts', content, 'utf8');
console.log('Fixed encoding');
