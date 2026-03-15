import fs from 'fs';

const filePath = './supabase/comprehensive_schema_20260309.sql';
const content = fs.readFileSync(filePath, 'utf8');

const regex = /INSERT\s+INTO\s+storage\.buckets\s*\([^)]*\)\s*VALUES\s*\([^)]*\)[^;]*;/gi;
let match;
const allStatements = [];

while ((match = regex.exec(content)) !== null) {
    const startIndex = match.index;
    allStatements.push({
        line: content.substring(0, startIndex).split('\n').length,
        statement: match[0].replace(/\n/g, ' ')
    });
}

allStatements.forEach(s => console.log(`Line ${s.line}: ${s.statement}`));
