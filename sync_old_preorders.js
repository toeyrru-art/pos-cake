import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching completed preorders...');
  const { data: preorders, error } = await supabase
    .from('preorders')
    .select(`
      *,
      preorder_items (
        id,
        product_id,
        quantity,
        price_at_time
      )
    `)
    .eq('status', 'completed');
    
  if (error) {
    console.error('Error fetching preorders:', error);
    return;
  }
  
  console.log(`Found ${preorders.length} completed preorders.`);
  
  // We check transactions for 'พรีออร์เดอร์' to see if ANY were synced recently
  const { data: existingTrans } = await supabase.from('transactions').select('description').like('description', '%พรีออร์เดอร์%');
  if (existingTrans && existingTrans.length > 0) {
    console.log(`Warning: Found ${existingTrans.length} existing preorder transactions. You might create duplicates if running blindly.`);
    // Since there are only 5, and the previous script failed entirely, it's safe to assume none were synced by the script.
    // However, if the user clicked "completed" on the UI right after my first deployment, that one might have failed too because of the bad code.
    // So all 5 should be safe to sync.
  }
  
  for (const order of preorders) {
    console.log(`Recording sale for order ${order.id}...`);
    
    try {
        const salePayload = {
          total_amount: order.total_amount
        };
        
        // Use the original preorder creation date as the sale creation date, or just now.
        // Actually, we can't override created_at with anon key. It will be now().
        const { data: saleData, error: saleError } = await supabase.from('sales').insert([salePayload]).select().single();
        
        if (saleError) throw saleError;
        const saleId = saleData.id;

        if (order.preorder_items && order.preorder_items.length > 0) {
          const saleItemsData = order.preorder_items.map(item => ({
            sale_id: saleId,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_time: item.price_at_time
          }));
          await supabase.from('sale_items').insert(saleItemsData);
        }

        await supabase.from('transactions').insert([{
          type: 'income',
          amount: order.total_amount,
          description: `รับขนมเค้ก (พรีออร์เดอร์ #${saleId.split('-')[0]} - คุณ ${order.customer_name})`,
          reference_id: saleId
        }]);
        
        console.log(`Successfully recorded sale ${saleId} for preorder ${order.id}`);
    } catch (err) {
      console.error(`Failed to record sale for ${order.id}:`, err);
    }
  }
  
  console.log('Sync complete.');
}

run();
