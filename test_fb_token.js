import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('store_settings').select('*').in('key', ['fb_page_token', 'fb_recipient_id']);
  console.log(data);
}
run();
