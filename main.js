import { promises as fs } from 'fs'
import pkg from 'https-proxy-agent'
import fetch from 'node-fetch'
const { HttpsProxyAgent } = pkg

import { randomUUID } from 'crypto'
import readline from 'readline'

import fakeUa from 'fake-useragent'


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function getRandomAcceptLanguage() {
  const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'it', 'pt', 'ru']
  const regions = [
    '',
    '-US',
    '-GB',
    '-CN',
    '-FR',
    '-DE',
    '-JP',
    '-KR',
    '-RU',
    '-BR',
  ]
  const weights = Array.from({ length: 10 }, (_, i) => (10 - i) / 10) // 权重从 1.0 到 0.1

  let result = []
  const count = Math.floor(Math.random() * 5) + 1 // 随机生成1到5种语言组合

  for (let i = 0; i < count; i++) {
    const lang = languages[Math.floor(Math.random() * languages.length)]
    const region = regions[Math.floor(Math.random() * regions.length)]
    const quality =
      weights[Math.floor(Math.random() * weights.length)].toFixed(1)

    const locale = lang + region
    const langQuality = locale + (quality < 1 ? `;q=${quality}` : '')
    if (!result.includes(langQuality)) {
      result.push(langQuality)
    }
  }

  return result.join(', ')
}
async function question(query) {
  return new Promise((resolve) =>
    rl.question(query, (answer) => resolve(answer))
  )
}

async function getBrowserIds(browserIdsFilePath) {
  try {
    const data = await fs.readFile(browserIdsFilePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return {}
  }
}

async function saveBrowserIds(browserIds, browserIdsFilePath) {
  try {
    await fs.writeFile(
      browserIdsFilePath,
      JSON.stringify(browserIds, null, 2),
      'utf-8'
    )
    console.log('已将浏览器ID保存到文件。')
  } catch (error) {
    console.error('保存浏览器ID出错:', error)
  }
}

async function getBrowserIdForProxy(proxy, browserIdsFilePath) {
  const browserIds = await getBrowserIds(browserIdsFilePath)
  if (browserIds[proxy]) {
    console.log(`使用现有的 browser_id ${proxy} 的认证`)
    return browserIds[proxy]
  } else {
    const newBrowserId = randomUUID()
    browserIds[proxy] = newBrowserId
    await saveBrowserIds(browserIds, browserIdsFilePath)
    console.log(`为代理 ${proxy} 生成新 browser_id: ${newBrowserId}`)
    return newBrowserId
  }
}

function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000)
}

async function pingProxy(proxy, browserId, uid,browserIdsFilePath, headers) {
  const timestamp = getCurrentTimestamp()
  const data = {
    uid,
    browser_id: browserId,
    timestamp,
    version: '1.0.0',
  }

  while (true) {
    try {
      const response = await request(
        'https://api.aigaea.net/api/network/ping',
        'POST',
        data,
        proxy,
        headers
      )
      console.log(`代理 ${proxy} 的 ping 成功:`, response)
      if (response.data && response.data.score < 50) {
        console.log(`代理 ${proxy} 的得分低于 50，正在重新认证...`)
        await authProxy(proxy, browserIdsFilePath, headers)
        break
      }
    } catch (error) {
      console.error(`代理 ${proxy} 的 ping 失败:`, error)
    }
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
}

async function authProxy(proxy, browserIdsFilePath, headers) {
  const data = {}
  const response = await request(
    'https://api.aigaea.net/api/auth/session',
    'POST',
    data,
    proxy,
    headers
  )
  if (response && response.data) {
    const uid = response.data.uid
    const browserId = await getBrowserIdForProxy(proxy, browserIdsFilePath)
    console.log(`代理 ${proxy} 验证成功，uid: ${uid}, browser_id: ${browserId}`)
    pingProxy(proxy, browserId, uid, browserIdsFilePath, headers)
  } else {
    console.error(`代理 ${proxy} 的认证失败`)
  }
}

async function request(url, method, data = null, proxy, headers) {
  try {
    const agent = new HttpsProxyAgent(proxy)
    const options = {
      method,
      headers,
      agent,
    }
    if (method === 'POST') {
      options.body = JSON.stringify(data)
    }
    const response = await fetch(url, options)
    return await response.json()
  } catch (error) {
    console.error(`代理出错: ${proxy}`, error)
  }
}

async function main(accessToken, proxyFilePath, browserIdsFilePath, headers) {
  headers.Authorization = `Bearer ${accessToken}`

  try {
    const proxyData = await fs.readFile(proxyFilePath, 'utf-8')
    const proxies = proxyData
      .split('\n')
      .filter((proxy) => proxy.trim())
      .map((proxy) => proxy.trim())

    if (proxies.length === 0) {
      console.error('在 proxy.txt 中未找到代理')
      return
    }
    await Promise.all(proxies.map((proxy) => authProxy(proxy, browserIdsFilePath, headers)))
  } catch (error) {
    console.error('发生错误:', error)
  }
}

async function run() {
  const users = (await fs.readFile('./user.txt', 'utf-8'))
    .split('\n')
    .filter((item) => !!item)
  for (const index in users) {
    const [_, token] = users[index].split(',')
    const i = Number(index) + 1

    const headers = {
      Accept: 'application/json, text/plain, */*',
      Connection: 'keep-alive',
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'User-Agent': fakeUa(),
      'Accept-Language': getRandomAcceptLanguage(),
    }

    await main(token, `./config/${i}.txt`, `./config/${i}.json`, headers)
  }
}
run()
