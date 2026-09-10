import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1];
const supabaseKey = keyMatch[1];

async function fix() {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
            query: `
                ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS notes TEXT;
            `
        })
    });
    const data = await res.text();
    console.log(res.status, data);
}

fix();
