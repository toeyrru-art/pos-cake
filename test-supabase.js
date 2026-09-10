import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('preorder_items')
        .select('product_id, quantity, preorders!inner(status)')
        .in('preorders.status', ['pending', 'accepted']);
  console.log("DATA:", JSON.stringify(data));
  console.log("ERROR:", JSON.stringify(error));
}
run();
