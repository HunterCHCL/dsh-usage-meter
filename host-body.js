// dsh-usage-meter 宿主侧（动态插件函数体，由 index.js 通过 dynamicCordisRunner 加载）
// 功能：余额查询（官方 user/balance）+ 按会话/模型/缓存命中细分的 token 用量计量 + 可配置价格表/峰谷定价。
// 注意：本文件不直接读取、打印、存储 API Key；Key 只通过 credentials.resolve 取用后放进子进程环境。

const HOME = __DSH_HOME__
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const USAGE_PATH = HOME + '\\dsh-client-usage.json'
const PRICING_PATH = HOME + '\\dsh-client-pricing.json'
const TOP_UP_URL = 'https://platform.deepseek.com/top_up'

// ===== 默认价格（元 / 百万 tokens） =====
const DEFAULT_MODELS = {
  'deepseek-v4-flash': { hit: 0.02, miss: 1, output: 2 },
  'deepseek-v4-pro': { hit: 0.025, miss: 3, output: 6 },
}
const DEFAULT_PEAK_WINDOWS = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
]
const DEFAULT_PEAK_MODELS = {
  'deepseek-v4-flash': { peak: { hit: 0.10, miss: 3.0, output: 9.0 }, offpeak: { hit: 0.05, miss: 1.5, output: 4.5 } },
  'deepseek-v4-pro': { peak: { hit: 0.30, miss: 9.0, output: 27.0 }, offpeak: { hit: 0.15, miss: 4.5, output: 13.5 } },
}

let pricing = null
let usageSessions = {}
let memoryTokens = 0
let usageWriteTimer = null
let subprocessForUsage = null
const ownSessionIds = new Set()

function cloneJson(v) { return JSON.parse(JSON.stringify(v)) }
function defaultPricing() {
  return { models: cloneJson(DEFAULT_MODELS), peakEnabled: false, peakWindows: cloneJson(DEFAULT_PEAK_WINDOWS), peakModels: cloneJson(DEFAULT_PEAK_MODELS) }
}
function ensurePricing() { if (pricing === null) pricing = defaultPricing(); return pricing }

function mergePricing(cfg) {
  const defaults = defaultPricing()
  if (!cfg || typeof cfg !== 'object') return defaults
  const models = {}
  for (const k in defaults.models) models[k] = cloneJson(defaults.models[k])
  for (const k in (cfg.models || {})) {
    const v = cfg.models[k]
    if (!v || typeof v !== 'object') continue
    const key = normalizeModel(k) || k
    models[key] = { hit: parsePrice(v.hit), miss: parsePrice(v.miss), output: parsePrice(v.output) }
  }
  const peakModels = {}
  for (const k in defaults.peakModels) peakModels[k] = cloneJson(defaults.peakModels[k])
  for (const k in (cfg.peakModels || {})) {
    const v = cfg.peakModels[k]
    if (!v || typeof v !== 'object') continue
    const key = normalizeModel(k) || k
    const p = v.peak || {}
    const op = v.offpeak || {}
    peakModels[key] = {
      peak: { hit: parsePrice(p.hit), miss: parsePrice(p.miss), output: parsePrice(p.output) },
      offpeak: { hit: parsePrice(op.hit), miss: parsePrice(op.miss), output: parsePrice(op.output) },
    }
  }
  const wins = []
  const rawWins = Array.isArray(cfg.peakWindows) ? cfg.peakWindows : defaults.peakWindows
  for (let i = 0; i < rawWins.length; i++) {
    const w = rawWins[i]
    if (w && toMin(w.start) >= 0 && toMin(w.end) >= 0) wins.push({ start: String(w.start), end: String(w.end) })
  }
  return {
    models,
    peakEnabled: !!cfg.peakEnabled,
    peakWindows: wins.length ? wins : cloneJson(DEFAULT_PEAK_WINDOWS),
    peakModels,
  }
}

function normalizeModel(model) {
  const m = String(model || '').toLowerCase()
  if (m === 'pro' || m === 'deepseek-pro' || m.indexOf('deepseek-v4-pro') !== -1) return 'deepseek-v4-pro'
  if (m === 'flash' || m.indexOf('deepseek-v4-flash') !== -1 || m.indexOf('deepseek-flash') !== -1) return 'deepseek-v4-flash'
  return m
}

function parsePrice(v) { const n = Number(v); return isFinite(n) && n >= 0 ? n : 0 }
function toMin(str) {
  const parts = String(str || '').split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (!isFinite(h) || !isFinite(m)) return -1
  return h * 60 + m
}
function isPeakAt(date, windows) {
  const d = date || new Date()
  const mins = d.getHours() * 60 + d.getMinutes()
  const ws = (windows && windows.length) ? windows : DEFAULT_PEAK_WINDOWS
  for (let i = 0; i < ws.length; i++) {
    const s = toMin(ws[i] && ws[i].start)
    const e = toMin(ws[i] && ws[i].end)
    if (s < 0 || e < 0) continue
    if (s < e) { if (mins >= s && mins < e) return true }
    else if (s > e) { if (mins >= s || mins < e) return true }
    else return true
  }
  return false
}
function money(tokens, pricePerMillion) {
  if (pricePerMillion === null || pricePerMillion === undefined) return 0
  const v = (tokens || 0) / 1000000 * pricePerMillion
  return Math.round(v * 100) / 100
}
function bucketTokens(bucket) { return (bucket && (bucket.hit || 0) + (bucket.miss || 0) + (bucket.output || 0)) || 0 }

// ===== 子进程 JSON 文件读写（动态插件无 fetch，也无 fs 模块） =====
async function readJsonFile(subprocess, filePath, envKey, maxBytes) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{console.log(require('fs').readFileSync(process.env.DSH_F,'utf8'))}catch(e){console.log('{}')}"
    const env = {}
    env[envKey] = filePath
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: maxBytes || 262144 }, stderr: { maxBytes: 8192 } }, graceMs: 8000, env: env })
    await handle.waitForExit()
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    return JSON.parse(out.trim() || '{}')
  } catch (e) { return {} }
}
async function writeJsonFile(subprocess, filePath, envKey, obj) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{require('fs').writeFileSync(process.env.DSH_F, process.env.DSH_V)}catch(e){console.error(e)}"
    const env = {}
    env[envKey] = filePath
    env.DSH_V = JSON.stringify(obj)
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: 8192 }, stderr: { maxBytes: 8192 } }, graceMs: 8000, env: env })
    await handle.waitForExit()
  } catch (e) {}
}

async function readUsageFile(subprocess) { return readJsonFile(subprocess, USAGE_PATH, 'DSH_U') }
async function writeUsageFile(subprocess, obj) { return writeJsonFile(subprocess, USAGE_PATH, 'DSH_U', obj) }
async function readPricingFile(subprocess) { return readJsonFile(subprocess, PRICING_PATH, 'DSH_P', 65536) }
async function writePricingFile(subprocess, obj) { return writeJsonFile(subprocess, PRICING_PATH, 'DSH_P', obj) }

function adoptUsageFile(file) {
  const sessions = file && file.sessions
  if (sessions === undefined || sessions === null || typeof sessions !== 'object') return
  for (const sid in sessions) {
    const v = sessions[sid]
    if (v && typeof v === 'object' && v.models && typeof v.models === 'object') usageSessions[sid] = v
  }
}

async function persistUsage() {
  const subprocess = subprocessForUsage
  if (subprocess === null) return
  const file = await readUsageFile(subprocess)
  const sessions = (file && file.sessions && typeof file.sessions === 'object') ? file.sessions : {}
  ownSessionIds.forEach(function (sid) { sessions[sid] = usageSessions[sid] })
  await writeUsageFile(subprocess, { sessions })
}

function addUsage(sessionId, model, usage, occurredAt) {
  try {
    const sid = String(sessionId || '')
    if (!sid) return
    const hit = (usage && usage.cacheReadTokens) || 0
    const miss = (usage && usage.inputTokens) || 0
    const out = (usage && usage.outputTokens) || 0
    if (hit + miss + out <= 0) return
    const cfg = ensurePricing()
    const peak = isPeakAt(occurredAt || new Date(), cfg.peakWindows)
    const bucket = peak ? 'peak' : 'offpeak'
    const mname = String(model || 'unknown')
    const s = usageSessions[sid] || (usageSessions[sid] = { models: {} })
    const mm = s.models[mname] || (s.models[mname] = { peak: { hit: 0, miss: 0, output: 0, count: 0 }, offpeak: { hit: 0, miss: 0, output: 0, count: 0 } })
    mm[bucket].hit += hit
    mm[bucket].miss += miss
    mm[bucket].output += out
    mm[bucket].count += 1
    ownSessionIds.add(sid)
    memoryTokens += hit + miss + out
    if (usageWriteTimer === null && subprocessForUsage !== null) {
      usageWriteTimer = setTimeout(function () {
        usageWriteTimer = null
        persistUsage().catch(function () {})
      }, 3000)
    }
  } catch (e) {}
}

// ===== 余额查询（复用 credentials，不把 key 交给浏览器） =====
function balanceScript() {
  return "(async()=>{try{const r=await fetch('" + BALANCE_URL + "',{headers:{Authorization:'Bearer '+process.env.DSH_BALANCE_KEY,Accept:'application/json'}});const t=await r.text();console.log(JSON.stringify({status:r.status,body:t}))}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()"
}

return {
  apply(ctx) {
    const credentials = ctx.get('credentials')
    const subprocess = ctx.get('subprocess')
    if (subprocess === undefined) return
    subprocessForUsage = subprocess
    ensurePricing()

    // 启动时从本地文件恢复配置与历史用量
    readPricingFile(subprocess).then(function (cfg) {
      pricing = mergePricing(cfg)
    }).catch(function () {})
    readUsageFile(subprocess).then(adoptUsageFile).catch(function () {})

    // 监听每次 LLM 流式调用，记录 usage（命中/未命中/输出）
    ctx.on('llm/stream', async function* (options, next) {
      const upstream = next()
      for await (const chunk of upstream) {
        if (chunk && chunk.type === 'usage') {
          addUsage(options && options.sessionId, options && options.model, chunk.usage, new Date())
        }
        yield chunk
      }
    })

    // ===== RPC：余额 =====
    harness.handle('deepseek-balance', async () => {
      try {
        if (credentials === undefined) return { ok: false, error: '凭据服务不可用' }
        const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
        if (resolved === undefined || typeof resolved.value !== 'string' || resolved.value === '') {
          return { ok: false, error: '未配置 DeepSeek API Key（DEEPSEEK_API_KEY）' }
        }
        const nodePath = await subprocess.resolveExecutable('node')
        const handle = subprocess.spawn({
          argv: [nodePath, '-e', balanceScript()],
          cwd: HOME,
          stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
          graceMs: 15000,
          env: { DSH_BALANCE_KEY: resolved.value },
        })
        await handle.waitForExit()
        const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
        const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
        const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
        if (last === undefined) return { ok: false, error: stderr.trim() || '余额请求无输出' }
        const parsed = JSON.parse(last)
        return { ok: true, status: parsed.status, body: parsed.body }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    // ===== RPC：本机总量（兼容旧语义） =====
    harness.handle('get-usage', async () => {
      try {
        let totalTokens = 0
        let sessionCount = 0
        for (const sid in usageSessions) {
          const s = usageSessions[sid]
          if (!s || !s.models || typeof s.models !== 'object') continue
          sessionCount++
          for (const model in s.models) {
            const b = s.models[model]
            totalTokens += bucketTokens(b.peak) + bucketTokens(b.offpeak)
          }
        }
        return { ok: true, currentTokens: memoryTokens, totalTokens, sessionCount }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    // ===== RPC：当前会话用量明细（模型 × 命中/未命中/输出 + 金额） =====
    harness.handle('get-session-usage', async (args) => {
      try {
        const cfg = ensurePricing()
        const sid = args && args.sessionId ? String(args.sessionId) : ''
        const s = usageSessions[sid]
        const models = []
        const totals = { hit: 0, miss: 0, output: 0, tokens: 0, amount: 0 }
        if (s && s.models && typeof s.models === 'object') {
          for (const model in s.models) {
            const b = s.models[model]
            const peak = b.peak || { hit: 0, miss: 0, output: 0, count: 0 }
            const off = b.offpeak || { hit: 0, miss: 0, output: 0, count: 0 }
            const key = normalizeModel(model)
            let hitAmount = 0
            let missAmount = 0
            let outputAmount = 0
            if (cfg.peakEnabled) {
              const pm = cfg.peakModels && cfg.peakModels[key]
              if (pm && pm.peak && pm.offpeak) {
                hitAmount = money(peak.hit, pm.peak.hit) + money(off.hit, pm.offpeak.hit)
                missAmount = money(peak.miss, pm.peak.miss) + money(off.miss, pm.offpeak.miss)
                outputAmount = money(peak.output, pm.peak.output) + money(off.output, pm.offpeak.output)
              }
            } else {
              const m = cfg.models && cfg.models[key]
              if (m) {
                hitAmount = money(peak.hit, m.hit) + money(off.hit, m.hit)
                missAmount = money(peak.miss, m.miss) + money(off.miss, m.miss)
                outputAmount = money(peak.output, m.output) + money(off.output, m.output)
              }
            }
            const hit = (peak.hit || 0) + (off.hit || 0)
            const miss = (peak.miss || 0) + (off.miss || 0)
            const out = (peak.output || 0) + (off.output || 0)
            const tokens = hit + miss + out
            const amount = Math.round((hitAmount + missAmount + outputAmount) * 100) / 100
            totals.hit += hit
            totals.miss += miss
            totals.output += out
            totals.tokens += tokens
            totals.amount = Math.round((totals.amount + amount) * 100) / 100
            models.push({
              model,
              key,
              hit,
              miss,
              output: out,
              tokens,
              amount,
              hitAmount: Math.round(hitAmount * 100) / 100,
              missAmount: Math.round(missAmount * 100) / 100,
              outputAmount: Math.round(outputAmount * 100) / 100,
              peak: { hit: peak.hit || 0, miss: peak.miss || 0, output: peak.output || 0, count: peak.count || 0 },
              offpeak: { hit: off.hit || 0, miss: off.miss || 0, output: off.output || 0, count: off.count || 0 },
            })
          }
        }
        return { ok: true, sessionId: sid, models, totals, pricing: cfg, topUpUrl: TOP_UP_URL }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    // ===== RPC：计价配置 =====
    harness.handle('get-pricing', async () => {
      try { return { ok: true, pricing: ensurePricing() } } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
    })

    harness.handle('set-pricing', async (args) => {
      try {
        const next = args && args.pricing
        if (!next || typeof next !== 'object') return { ok: false, error: '配置无效' }
        pricing = mergePricing(next)
        await writePricingFile(subprocess, pricing)
        return { ok: true, pricing }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
  },
}
