import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const fDate = "2026-09-09";
  const { data: pData } = await supabase.from('preorder_items')
        .select('product_id, quantity, preorders!inner(status, pickup_date)')
        .in('preorders.status', ['pending', 'accepted', 'completed'])
        .gte('preorders.pickup_date', `${fDate}`)
        .lt('preorders.pickup_date', `${fDate}T23:59:59.999Z`);
  
  const { data: sData } = await supabase.from('sale_items')
      .select('product_id, quantity, created_at')
      .gte('created_at', `${fDate}T00:00:00`)
      .lt('created_at', `${fDate}T23:59:59.999Z`);
      
  let rCount = 0;
  pData.forEach(i => { if(i.product_id === '4eb95891-f687-4806-b75d-203dbb2e60e5') rCount += i.quantity; });
  console.log("Preorder Count:", rCount);
  
  let sCount = 0;
  sData.forEach(i => { if(i.product_id === '4eb95891-f687-4806-b75d-203dbb2e60e5') sCount += i.quantity; });
  console.log("Sale Count:", sCount);
}
run();
