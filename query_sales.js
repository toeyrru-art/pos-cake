import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('sales').select('created_at').order('created_at', { ascending: false });
  console.log('Total sales:', data.length);
  if (data.length > 0) {
    console.log('Earliest:', data[data.length-1].created_at);
    console.log('Latest:', data[0].created_at);
  }
}
run();
