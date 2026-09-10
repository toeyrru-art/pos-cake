import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await supabase
    .from('preorders')
    .select(`
      *,
      preorder_items (
        id,
        product_id,
        quantity,
        price_at_time,
        notes,
        is_received,
        products ( name )
      )
    `)
    .order('pickup_date', { ascending: true });

  if (error) {
    console.error("Supabase Error:", error);
    return;
  }

  let hasError = false;
  data.forEach(order => {
    if (order.status === 'cancelled') return;
    if (order.preorder_items) {
      order.preorder_items.forEach(item => {
        const prodName = item.products?.name || 'เค้ก';
        let flavorText = '';
        if (item.notes) {
          try {
            const match = item.notes.match(/(?:หน้า\/รส:\s*)(.*)/);
          } catch (e) {
            console.error("Crash at match!", typeof item.notes, item.notes);
            hasError = true;
          }
        }
      });
    }
    
    try {
      (order.total_amount || 0).toFixed(2);
    } catch (e) {
      console.error("Crash at toFixed!", typeof order.total_amount, order.total_amount);
      hasError = true;
    }
  });
  
  if (!hasError) console.log("No simulated crash found.");
}
run();
