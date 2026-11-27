const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5174/media/learning_modules/extracted_15/index_lms.html';
const port = 9222;

console.log('Launching headless Chrome...');
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--no-sandbox',
  '--disable-web-security',
  targetUrl
]);

setTimeout(async () => {
  try {
    const listReq = http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          console.log('Targets:', targets.map(t => ({ title: t.title, url: t.url, ws: t.webSocketDebuggerUrl })));
        } catch (e) {
          console.error('Parse err:', e);
        }
        chrome.kill();
      });
    });
    listReq.on('error', (err) => {
      console.error('List error:', err.message);
      chrome.kill();
    });
  } catch (err) {
    console.error('Error:', err);
    chrome.kill();
  }
}, 3000);
