import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseAnonKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Fetching units...');
  const { data: units, error: unitsError } = await supabase.from('units').select('*');
  console.log('Units:', units);
  if (unitsError) console.error('Units Error:', unitsError);

  console.log('Inserting unit test...');
  const { data: insertData, error: insertError } = await supabase.from('units').insert([{ name: 'test_unit_' + Date.now() }]).select();
  if (insertError) {
    console.error('Insert Error:', insertError);
  } else {
    console.log('Insert Success:', insertData);
  }
}

test();
