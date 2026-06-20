const fs = require('fs');
let file = 'supabase/migrations/20260101000000_initial_schema.sql';
let content = fs.readFileSync(file, 'utf8');

// We need to make sure every CREATE POLICY in our appended block has a DROP POLICY IF EXISTS before it.
// Instead of complex regex, let's just replace all `CREATE POLICY "X" ON Y` with `DROP POLICY IF EXISTS "X" ON Y;\nCREATE POLICY "X" ON Y` in the entire file or just the appended block.
// Since the appended block is at the very end, we can just replace it.

let restoreBlockStart = content.indexOf('-- Restore profiles table');
if (restoreBlockStart !== -1) {
    let before = content.substring(0, restoreBlockStart);
    let after = content.substring(restoreBlockStart);
    
    // In the 'after' block, replace CREATE POLICY
    after = after.replace(/CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s]+)/g, 'DROP POLICY IF EXISTS "$1" ON $2;\nCREATE POLICY "$1" ON $2');
    
    fs.writeFileSync(file, before + after);
    console.log("Made policies idempotent!");
} else {
    console.log("Could not find restore block");
}
