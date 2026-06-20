import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log('Fetching awaiting_agent orders...');
    const { data: orderMissions, error: orderError } = await supabase
        .from("orders")
        .select(`
            id, status,
            shipments (id, order_id, status)
        `);
    const { data: enumData, error } = await supabase.rpc('get_shipment_status_enum');
    if (error) {
        // Fallback: raw SQL via another method or just fetch an existing shipment
        const { data: cols } = await supabase.from('shipments').select('status').limit(1);
        console.log('Sample shipment status:', cols);
    }
    
    // Instead of RPC, let's just attempt to insert a shipment with a dummy status
    const { error: insertError } = await supabase.from('shipments').insert({
        order_id: '48f5a433-056f-4091-a3d0-90f77bcbaf88',
        status: 'broadcast'
    });
    console.log('Broadcast insert error:', insertError);
}
main().catch(console.error);
