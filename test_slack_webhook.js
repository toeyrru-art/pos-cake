import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sxyiqsakqmxtjebwplff.supabase.co', 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu');
const { data, error } = await supabase.from('store_settings').select('*');
console.log(data);
