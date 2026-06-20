const fs = require('fs');
const content = fs.readFileSync('supabase/all_migrations_combined.sql', 'utf8');

const tableNames = [
    'profiles', 'user_roles', 'wallets', 'wallet_transactions', 
    'products', 'orders', 'order_items', 'shipments', 
    'promoter_campaigns', 'referrals', 'payout_requests', 
    'fee_config', 'notifications', 'cart_items', 
    'likes', 'comments', 'seller_verifications', 
    'issues', 'disputes', 'vehicle_types', 'commissions',
    'system_metrics', 'chat_messages', 'product_ratings'
];

fs.mkdirSync('supabase/schema_by_table', { recursive: true });

const blocks = content.split(/\n\s*\n/);

const tableFiles = {};
for (const t of tableNames) {
    tableFiles[t] = [];
}
let enumsAndShared = [];

for (const block of blocks) {
    let matched = false;
    for (const t of tableNames) {
        const regex = new RegExp(`(?:TABLE|ON|INTO|INDEX.*ON)\\s+public\\.${t}\\b`, 'i');
        if (regex.test(block)) {
            tableFiles[t].push(block.trim());
            matched = true;
            break;
        }
    }
    if (!matched) {
        enumsAndShared.push(block.trim());
    }
}

for (const t of tableNames) {
    if (tableFiles[t].length > 0) {
        fs.writeFileSync(`supabase/schema_by_table/${t}.sql`, tableFiles[t].join('\n\n'));
    }
}

fs.writeFileSync('supabase/schema_by_table/00_enums_functions_storage.sql', enumsAndShared.join('\n\n'));
console.log('Schema successfully split into supabase/schema_by_table/');
