import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// simple env loader
const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    acc[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
  return acc;
}, {});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('store_settings').select('*').eq('key', 'push_subscriptions');
  console.log(JSON.stringify(data, null, 2));
}
run();
