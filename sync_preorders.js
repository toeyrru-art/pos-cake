import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';

// Need service role key or we can just read using anon key if RLS allows.
// Wait, we don't have service role key. Let's find anon key in .env
