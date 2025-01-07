const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent');
const path = require('path');
const crypto = require('crypto');
const fakeUa = require('fake-useragent');

function getRandomAcceptLanguage () {
  const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'it', 'pt', 'ru'];
  const regions = ['', '-US', '-GB', '-CN', '-FR', '-DE', '-JP', '-KR', '-RU', '-BR'];
  const weights = Array.from({ length: 10 }, (_, i) => (10 - i) / 10);  // 权重从 1.0 到 0.1

  let result = [];
  const count = Math.floor(Math.random() * 5) + 1;  // 随机生成1到5种语言组合

  for (let i = 0; i < count; i++) {
    const lang = languages[Math.floor(Math.random() * languages.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const quality = weights[Math.floor(Math.random() * weights.length)].toFixed(1);

    const locale = lang + region;
    const langQuality = locale + (quality < 1 ? `;q=${quality}` : '');
    if (!result.includes(langQuality)) {
      result.push(langQuality);
    }
  }

  return result.join(', ');
}
async function main (accessToken, id8, proxyPath, jsonPath) {
  let headers = {
    'Accept': 'application/json, text/plain, */*',
    'origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': fakeUa(),
    'Accept-Language': getRandomAcceptLanguage()
  };
  const browserIdFilePath = path.join(__dirname, jsonPath);
  async function coday (url, method, payloadData = null, proxy) {
    try {
      const agent = new HttpsProxyAgent(proxy);
      let response;
      const options = {
        method: method,
        headers: headers,
        agent: agent
      };

      if (method === 'POST') {
        options.body = JSON.stringify(payloadData);
        response = await fetch(url, options);
      } else {
        response = await fetch(url, options);
      }

      return await response.json();
    } catch (error) {
      console.error('Error with proxy:', proxy);
    }
  }
  function generateBrowserId () {
    const rdm = crypto.randomUUID().slice(8);
    const browserId = `${id8}${rdm}`;
    return browserId;
  }
  async function loadBrowserIds () {
    try {
      const data = await fs.readFile(browserIdFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }
  async function saveBrowserIds (browserIds) {
    try {
      await fs.writeFile(browserIdFilePath, JSON.stringify(browserIds, null, 2), 'utf-8');
      console.log('Browser IDs saved to file.');
    } catch (error) {
      console.error('Error saving browser IDs:', error);
    }
  }
  async function getBrowserId (proxy) {
    const browserIds = await loadBrowserIds();
    if (browserIds[proxy]) {
      console.log(`Using existing browser_id for proxy ${proxy}`);
      return browserIds[proxy];
    } else {
      const newBrowserId = generateBrowserId();
      browserIds[proxy] = newBrowserId;
      await saveBrowserIds(browserIds);
      console.log(`Generated new browser_id for proxy ${proxy}: ${newBrowserId}`);
      return newBrowserId;
    }
  }
  function getCurrentTimestamp () {
    return Math.floor(Date.now() / 1000);
  }
  async function pingProxy (proxy, browser_id, uid) {
    const timestamp = getCurrentTimestamp();
    const pingPayload = { "uid": uid, "browser_id": browser_id, "timestamp": timestamp, "version": "1.0.1" };

    while (true) {
      try {
        const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload, proxy);
        await coday('https://api.aigaea.net/api/network/ip', 'GET', {}, proxy);
        console.log(`Ping successful for proxy ${proxy}:`, pingResponse);

        if (pingResponse.data && pingResponse.data.score < 50) {
          console.log(`Score below 50 for proxy ${proxy}, re-authenticating...`);
          await handleAuthAndPing(proxy);
          break;
        }
      } catch (error) {
        console.error(`Ping failed for proxy ${proxy}:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 600000));
    }
  }
  async function handleAuthAndPing (proxy) {
    const payload = {};
    const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST', payload, proxy);

    if (authResponse && authResponse.data) {
      const uid = authResponse.data.uid;
      const browser_id = await getBrowserId(proxy);
      console.log(`Authenticated for proxy ${proxy} with uid ${uid} and browser_id ${browser_id}`);
      pingProxy(proxy, browser_id, uid);
    } else {
      console.error(`Authentication failed for proxy ${proxy}`);
    }
  }

  try {
    const proxyList = await fs.readFile(proxyPath, 'utf-8');
    const proxies = proxyList.split('\n').map(proxy => proxy.trim()).filter(proxy => proxy);

    if (proxies.length === 0) {
      console.error("No proxies found in" + proxyPath);
      return;
    }

    for (const proxy of proxies) {
     await handleAuthAndPing(proxy) 
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }

}
async function run() {
  const users = (await fs.readFile('./user.txt','utf-8')).split('\n').filter(item => !!item)
  for (const index in users) {
    const [browserId, token] = users[index].split(',')
    const [id8] = browserId.split('-')
    console.log('index ----------', index)
    const i = Number(index) + 1
    await main(token, id8, `./config/${i}.txt`, `./config/${i}.json`)
  }
}
run()