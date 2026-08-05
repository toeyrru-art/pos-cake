const url = "https://sxyiqsakqmxtjebwplff.supabase.co/rest/v1/preorders?select=id,pickup_date,pickup_time,status,created_at,preorder_items(id,quantity)&limit=2&order=created_at.desc";
const anonKey = "sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu";
fetch(url, {
  headers: {
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`
  }
}).then(async r => {
  if (!r.ok) console.error(await r.text());
  else console.log(await r.json());
}).catch(console.error);
