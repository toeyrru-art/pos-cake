import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  const dummyContent = 'dummy image content';
  const fileName = `test_${Date.now()}.txt`;
  
  const { data, error } = await supabase.storage
    .from('slips')
    .upload(fileName, dummyContent, {
      contentType: 'text/plain',
    });
    
  if (error) {
    console.error('Upload failed:', error.message);
  } else {
    console.log('Upload successful:', data);
  }
}

testUpload();
