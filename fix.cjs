const fs = require('fs');

const path = 'supabase/migrations/20260101000000_initial_schema.sql';
let content = fs.readFileSync(path, 'utf8');

// Find the first instance of `-- Restore profiles table` and everything up to the next `-- Restore profiles table` or `-- 6. SECURITY / RLS`
let firstRestoreIndex = content.indexOf('-- Restore profiles table');
let securityRlsIndex = content.indexOf('-- 6. SECURITY / RLS');
let secondRestoreIndex = content.indexOf('-- Restore profiles table', firstRestoreIndex + 1);

if (firstRestoreIndex !== -1 && securityRlsIndex !== -1 && firstRestoreIndex < securityRlsIndex) {
    // The bad insertion is before security RLS. Let's remove it.
    let textToRemove = content.substring(firstRestoreIndex, securityRlsIndex);
    content = content.replace(textToRemove, '');
    console.log('Removed bad block before SECURITY / RLS');
}

// Now let's fix the second block which I accidentally broke (deleted the table header)
content = content.replace(
    /(\$\$ LANGUAGE plpgsql SECURITY DEFINER;\s+)(\s+display_name TEXT,)/,
    `$1\n-- Restore profiles table\nCREATE TABLE IF NOT EXISTS public.profiles (\n    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,\n$2`
);

fs.writeFileSync(path, content);
console.log('Fixed the file!');
