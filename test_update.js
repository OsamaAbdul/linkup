import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://oljhcvpwulxifdxmcerc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9samhjdnB3dWx4aWZkeG1jZXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4NzEwMiwiZXhwIjoyMDg5MTYzMTAyfQ.NJVsKL8HYvjLAeP7nz3EemnQK2o4-UkIYu2uWCJC5Ik";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'profiles' });
    // If rpc doesn't exist, we will try to just do a manual update check
    const userId = 'd4698584-3927-40a3-9db1-d53b7e2f35ac';
    const { error: updateError } = await supabase.from('profiles').update({ is_online: true }).eq('id', userId);
    process.stdout.write("Update Test Result: " + (updateError ? updateError.message : "Success") + "\n");
}
checkRLS();
