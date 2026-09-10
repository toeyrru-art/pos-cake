import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('preorder_items')
        .select('product_id, quantity, preorders!inner(status)')
        .in('preorders.status', ['pending', 'accepted']);
  
  let reservedCounts = {};
  if (data) {
    data.forEach(item => {
      reservedCounts[item.product_id] = (reservedCounts[item.product_id] || 0) + item.quantity;
    });
  }
  console.log("RESERVED COUNTS:", JSON.stringify(reservedCounts));
}
run();
