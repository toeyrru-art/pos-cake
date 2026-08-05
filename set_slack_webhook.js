import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase
    .from('store_settings')
    .upsert([
      { key: 'slack_webhook_url', value: 'https://hooks.slack.com/services/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' }
    ], { onConflict: 'key' });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully saved Slack webhook URL to database.');
  }
}
run();
