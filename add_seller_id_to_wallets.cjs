const fs = require('fs');

let path = 'supabase/migrations/20240101000000_squashed_init.sql';
let content = fs.readFileSync(path, 'utf8');

// Replace the CREATE TABLE definition
const oldDef = `CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) UNIQUE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,`;

const newDef = `CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) UNIQUE,
    seller_id UUID REFERENCES auth.users(id),
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,`;

content = content.replace(oldDef, newDef);

fs.writeFileSync(path, content);
console.log('Successfully injected seller_id column into wallets table!');
