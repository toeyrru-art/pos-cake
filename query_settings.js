const url = "https://sxyiqsakqmxtjebwplff.supabase.co/rest/v1/store_settings?select=*";
const anonKey = "sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu";
fetch(url, {
  headers: {
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`
  }
}).then(r => r.json()).then(console.log).catch(console.error);
