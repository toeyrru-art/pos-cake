import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3040/calendar', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  const bodyHandle = await page.$('body');
  const html = await page.evaluate(body => body.innerHTML, bodyHandle);
  console.log(html);
  await browser.close();
})();
