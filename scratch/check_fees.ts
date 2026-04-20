
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkFees() {
  const { data, error } = await supabase
    .from('fee_config')
    .select('*')
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log(JSON.stringify(data, null, 2))
}

checkFees()
