import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sxyiqsakqmxtjebwplff.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY'); // I need the service role key or run raw SQL if enabled
