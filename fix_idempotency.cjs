const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HomePC', 'Desktop', 'linkup-marketplace', 'supabase', 'full_system_schema.sql');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Force CREATE TABLE IF NOT EXISTS
content = content.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)(public\.)?(\w+)/gi, 'CREATE TABLE IF NOT EXISTS $1$2');

// 2. Force ALTER TABLE ... ADD COLUMN IF NOT EXISTS
content = content.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)(\w+)/gi, 'ADD COLUMN IF NOT EXISTS $1');

// 3. Profiles user_id compatibility fix
if (!content.includes('user_id UUID DEFAULT auth.uid()')) {
    content = content.replace(/(CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.profiles\s*\(\s*id\s+UUID\s+PRIMARY\s+KEY\s+[^,]+,)/i, 
        '$1\n    user_id UUID DEFAULT auth.uid(), -- For compatibility with existing queries');
}

// 4. Process Policies (Global multiline)
// Use a function that processes matches in sequence to handle duplicate strings correctly
let newContent = "";
let lastIndex = 0;
const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w\.]+)/gis;
let m;
while ((m = policyRegex.exec(content)) !== null) {
    newContent += content.substring(lastIndex, m.index);
    const name = m[1];
    const table = m[2];
    const match = m[0];
    
    // Check if DROP already exists in lookback (approx 300 chars)
    const lookback = content.substring(Math.max(0, m.index - 300), m.index);
    if (lookback.includes(`DROP POLICY IF EXISTS "${name}" ON ${table}`)) {
        newContent += match;
    } else {
        newContent += `DROP POLICY IF EXISTS "${name}" ON ${table};\n${match}`;
    }
    lastIndex = policyRegex.lastIndex;
}
newContent += content.substring(lastIndex);
content = newContent;

// 5. Process Triggers (Global multiline)
newContent = "";
lastIndex = 0;
const triggerRegex = /CREATE\s+TRIGGER\s+(\w+)\s+(?:BEFORE|AFTER|INSTEAD\s+OF)\s+.+?\s+ON\s+([\w\.]+)/gis;
while ((m = triggerRegex.exec(content)) !== null) {
    newContent += content.substring(lastIndex, m.index);
    const name = m[1];
    const table = m[2];
    const match = m[0];
    
    const lookback = content.substring(Math.max(0, m.index - 300), m.index);
    if (lookback.includes(`DROP TRIGGER IF EXISTS ${name} ON ${table}`)) {
        newContent += match;
    } else {
        newContent += `DROP TRIGGER IF EXISTS ${name} ON ${table};\n${match}`;
    }
    lastIndex = triggerRegex.lastIndex;
}
newContent += content.substring(lastIndex);
content = newContent;

// 6. Wrap Enums Safely
content = content.replace(/(?<!BEGIN\s*\n\s*)CREATE\s+TYPE\s+([\w\.]+)\s+AS\s+ENUM\s*\(([^;]+)\);/gi, (match, name, values) => {
    return `DO $type_safe$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name.split('.').pop()}') THEN CREATE TYPE ${name} AS ENUM (${values.trim()}); END IF; END $type_safe$;`;
});

// 7. Structural Safety Wrap (Global multiline)
// This wraps bare statements that are NOT in a DO block.
// We use a safe delimiter $safe$ and check for table existence.
newContent = "";
lastIndex = 0;
const bareStatements = /(?<!BEGIN\s*\n\s*)(DROP\s+POLICY\s+IF\s+EXISTS\s+"([^"]+)"\s+ON\s+([\w\.]+);|CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w\.]+)\s+[^;]+;|ALTER\s+TABLE\s+([\w\.]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;)/gis;
while ((m = bareStatements.exec(content)) !== null) {
    newContent += content.substring(lastIndex, m.index);
    const match = m[0];
    const table = m[2] || m[3] || m[4] || m[5] || m[6]; // Capture groups for table names
    
    // Better capture of table name
    let foundTable = "";
    if (match.toLowerCase().includes("on")) {
        const parts = match.split(/\s+on\s+/i);
        if (parts.length > 1) {
            foundTable = parts[1].split(/[\s;]/)[0];
        }
    } else if (match.toLowerCase().includes("alter table")) {
         const parts = match.split(/\s+table\s+/i);
         if (parts.length > 1) {
             foundTable = parts[1].split(/[\s]/)[0];
         }
    }

    if (!foundTable) {
        newContent += match;
    } else {
        const cleanTable = foundTable.split('.').pop();
        newContent += `DO $safe$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${cleanTable}') THEN
        ${match}
    END IF;
EXCEPTION WHEN undefined_table THEN null;
END $safe$;`;
    }
    lastIndex = bareStatements.lastIndex;
}
newContent += content.substring(lastIndex);
content = newContent;

// 8. Storage Bucket Idempotency
const bucketRegex = /(INSERT\s+INTO\s+storage\.buckets\s*\([^)]+\)\s+VALUES\s*\([^)]+\))/gis;
content = content.replace(bucketRegex, (match, p1, offset) => {
    const tail = content.substring(offset + match.length, offset + match.length + 100);
    if (tail.match(/^\s*;?\s*ON\s+CONFLICT/i)) return match;
    return `${match} ON CONFLICT (id) DO NOTHING`;
});

fs.writeFileSync(filePath, content);
console.log('Processed full_system_schema.sql for reinforced idempotency.');
