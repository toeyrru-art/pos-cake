import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.URL, process.env.KEY);
async function run() {
  const { data, error } = await supabase.from('preorders').update({ payment_method: 'cash' }).eq('id', 'c0b6c6fd-0ebd-47ec-9150-573d2eb71629');
  console.log('Update cash:', error || 'Success');
  await supabase.from('preorders').update({ payment_method: 'pay_later' }).eq('id', 'c0b6c6fd-0ebd-47ec-9150-573d2eb71629');
}
run();
