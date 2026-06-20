const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f !== 'full_system_schema.sql' && f !== 'DIAGNOSTIC_settlement.sql' && f !== 'verification_script.sql')
    .sort();

let combined = '';
for (const file of files) {
    combined += `-- Migration: ${file}\n`;
    combined += fs.readFileSync(path.join(migrationsDir, file), 'utf8') + '\n\n';
}

// 1. Fix Enums
let lines = combined.split('\n');
let seenTypes = new Set();
let insideRedundantEnum = false;

for (let i = 0; i < lines.length; i++) {
    let m = lines[i].match(/CREATE TYPE public\.([a-z_]+) AS ENUM/i);
    if (m && !insideRedundantEnum) {
        let type = m[1].toLowerCase();
        if (seenTypes.has(type)) {
            insideRedundantEnum = true;
        } else {
            seenTypes.add(type);
        }
    }
    
    if (insideRedundantEnum) {
        let original = lines[i];
        lines[i] = '-- REDUNDANT: ' + original;
        if (original.includes(';')) {
            insideRedundantEnum = false;
        }
    }
}
combined = lines.join('\n');

// 2. Fix Storage Buckets
combined = combined.replace(/INSERT INTO storage\.buckets\s*\([^)]+\)\s*VALUES\s*\([^)]+\)(?!\s*ON CONFLICT)/gi, match => match + ' ON CONFLICT DO NOTHING');

// 3. Fix Policies
combined = combined.replace(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(public|storage)\.([a-z_]+)/gi, 'DROP POLICY IF EXISTS "$1" ON $2.$3;\nCREATE POLICY "$1" ON $2.$3');

// 4. Fix Tables
combined = combined.replace(/CREATE\s+TABLE\s+(public\.[a-z_]+)/gi, 'CREATE TABLE IF NOT EXISTS $1');

// 5. Fix Triggers
combined = combined.replace(/CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+((?:BEFORE|AFTER|INSTEAD OF)\s+(?:INSERT|UPDATE|DELETE|TRUNCATE)(?:\s+OR\s+(?:INSERT|UPDATE|DELETE|TRUNCATE))*\s+ON\s+([a-zA-Z0-9_.]+))/gi, 'DROP TRIGGER IF EXISTS $1 ON $3;\nCREATE TRIGGER $1 $2');

fs.writeFileSync('supabase/all_migrations_combined.sql', combined);
console.log('Successfully rebuilt all_migrations_combined.sql with Trigger fixes!');
