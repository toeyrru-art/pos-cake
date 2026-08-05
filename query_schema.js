import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('preorders')
    .select('*, preorder_items(*, products(*))')
    .limit(1);
    
  console.log(JSON.stringify(data, null, 2));
}
run();
