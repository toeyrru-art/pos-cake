import handler from './api/cron/evening.js';
const req = { method: 'GET' };
const res = { 
  status: (code) => ({ 
    json: (data) => console.log(code, data) 
  }) 
};
handler(req, res);
