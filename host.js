// dsh-usage-meter 静态宿主插件（ESM bundle 入口）
// 用量来源：直接读取 DSH session 事件日志（request/header 记录模型，assistant/chunk 与
// assistant/message 记录 usage），因此打开会话即可计算完整历史用量（含插件安装前的记录）。
// 余额：DeepSeek 官方 user/balance。API Key 只通过 credentials.resolve 或环境变量取用，
// 不读取、不打印、不进入浏览器。
import os from 'node:os'
import path from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const TOP_UP_URL = 'https://platform.deepseek.com/top_up'
const PRICING_PATH = path.join(DSH_HOME, 'dsh-client-pricing.json')

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

function cloneJson(v) { return JSON.parse(JSON.stringify(v)) }
function defaultPricing() {
  return { models: cloneJson(DEFAULT_MODELS), peakEnabled: false, peakWindows: cloneJson(DEFAULT_PEAK_WINDOWS), peakModels: cloneJson(DEFAULT_PEAK_MODELS) }
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

function zeroBuckets() {
  return { peak: { hit: 0, miss: 0, output: 0, count: 0 }, offpeak: { hit: 0, miss: 0, output: 0, count: 0 } }
}

export class DshUsageMeterService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'dshUsageMeter')
    this.ctx = ctx
    this.pricing = defaultPricing()
    this.sessionUsageCache = {}
    void this.start()
  }

  async start() {
    try {
      this.pricing = mergePricing(await this.readJsonFile(PRICING_PATH))
    } catch (e) {
      console.error('[dsh-usage-meter] start failed: ' + ((e && e.message) || e))
    }
  }

  async runNode(script, env, graceMs) {
    const subprocess = this.ctx.get('subprocess')
    if (!subprocess) return { stdout: '', stderr: 'subprocess 不可用' }
    const nodePath = await subprocess.resolveExecutable('node')
    const handle = subprocess.spawn({
      argv: [nodePath, '-e', script],
      cwd: DSH_HOME,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } },
      graceMs: graceMs || 15000,
      env: env || {},
    })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }

  async readJsonFile(p) {
    const { stdout } = await this.runNode("try{console.log(require('fs').readFileSync(process.env.DSH_F,'utf8'))}catch(e){console.log('{}')}", { DSH_F: p }, 8000)
    try { return JSON.parse(stdout.trim() || '{}') } catch (e) { return {} }
  }

  async writeJsonFile(p, obj) {
    await this.runNode("try{require('fs').writeFileSync(process.env.DSH_F, process.env.DSH_V)}catch(e){console.error(e)}", { DSH_F: p, DSH_V: JSON.stringify(obj) }, 8000)
  }

  balanceScript() {
    return "(async()=>{try{const r=await fetch('" + BALANCE_URL + "',{headers:{Authorization:'Bearer '+process.env.DSH_BALANCE_KEY,Accept:'application/json'}});const t=await r.text();console.log(JSON.stringify({status:r.status,body:t}))}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()"
  }

  async deepseekBalance() {
    try {
      const subprocess = this.ctx.get('subprocess')
      if (!subprocess) return { ok: false, error: 'NO_SUBPROCESS' }
      let keyValue = null
      const credentials = this.ctx.get('credentials')
      if (credentials) {
        try {
          const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
          if (resolved && typeof resolved.value === 'string' && resolved.value !== '') keyValue = resolved.value
        } catch (e) {}
      }
      if (keyValue === null && typeof process !== 'undefined' && process.env && process.env.DEEPSEEK_API_KEY) {
        keyValue = process.env.DEEPSEEK_API_KEY
      }
      if (keyValue === null || keyValue === '') {
        return { ok: false, error: 'NO_API_KEY' }
      }
      const { stdout, stderr } = await this.runNode(this.balanceScript(), { DSH_BALANCE_KEY: keyValue }, 15000)
      const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
      if (last === undefined) return { ok: false, error: stderr.trim() || 'NO_OUTPUT' }
      const parsed = JSON.parse(last)
      return { ok: true, status: parsed.status, body: parsed.body }
    } catch (e) {
      console.error('[dsh-usage-meter] deepseekBalance error: ' + ((e && e.stack) || e))
      return { ok: false, error: String((e && e.message) || e) }
    }
  }

  /**
   * 从 session 事件日志折叠出 模型 × 峰谷桶 的 token 用量。
   * - request/header 记录当前请求的模型（EpochHeader.config.model）。
   * - assistant/chunk 的 usage 块提供流式期间的早期样本；
   *   assistant/message 的 data.usage 提供该 step 的最终样本。
   * - 同 turn/step 的样本采用 last-wins 替换，避免 chunk 与 message 重复计数。
   */
  computeSessionUsage(events) {
    const bucketsByModel = {}
    let currentModel = 'unknown'
    let lastStep = null
    events = events || []
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      if (!ev || !ev.data) continue
      if (ev.type === 'request/header' && ev.data.header && ev.data.header.config) {
        currentModel = String(ev.data.header.config.model || 'unknown')
        continue
      }
      let turn
      let step
      let usage
      if (ev.type === 'assistant/chunk' && ev.data.chunk && ev.data.chunk.type === 'usage') {
        turn = ev.data.turn
        step = ev.data.step
        usage = ev.data.chunk.usage
      } else if (ev.type === 'assistant/message' && ev.data.usage !== undefined) {
        turn = ev.data.turn
        step = ev.data.step
        usage = ev.data.usage
      }
      if (usage === undefined) continue
      const hit = (usage && usage.cacheReadTokens) || 0
      const miss = (usage && usage.inputTokens) || 0
      const out = (usage && usage.outputTokens) || 0
      if (hit + miss + out <= 0) continue
      const peak = isPeakAt(new Date(ev.time || Date.now()), this.pricing.peakWindows)
      const bucket = peak ? 'peak' : 'offpeak'
      const stepKey = turn + ':' + step

      // 同一步已有样本：先减去旧样本再计入新样本（last-wins）
      if (lastStep !== null && lastStep.key === stepKey) {
        const prevModelBuckets = bucketsByModel[lastStep.model]
        if (prevModelBuckets) {
          const pb = lastStep.peak ? prevModelBuckets.peak : prevModelBuckets.offpeak
          pb.hit -= lastStep.hit
          pb.miss -= lastStep.miss
          pb.output -= lastStep.out
          pb.count -= 1
        }
      }
      lastStep = { key: stepKey, model: currentModel, peak, hit, miss, out }

      const modelBuckets = bucketsByModel[currentModel] || (bucketsByModel[currentModel] = zeroBuckets())
      const b = peak ? modelBuckets.peak : modelBuckets.offpeak
      b.hit += hit
      b.miss += miss
      b.output += out
      b.count += 1
    }

    const models = []
    const totals = { hit: 0, miss: 0, output: 0, tokens: 0, amount: 0 }
    for (const model in bucketsByModel) {
      const b = bucketsByModel[model]
      const key = normalizeModel(model)
      let hitAmount = 0
      let missAmount = 0
      let outputAmount = 0
      if (this.pricing.peakEnabled) {
        const pm = this.pricing.peakModels && this.pricing.peakModels[key]
        if (pm && pm.peak && pm.offpeak) {
          hitAmount = money(b.peak.hit, pm.peak.hit) + money(b.offpeak.hit, pm.offpeak.hit)
          missAmount = money(b.peak.miss, pm.peak.miss) + money(b.offpeak.miss, pm.offpeak.miss)
          outputAmount = money(b.peak.output, pm.peak.output) + money(b.offpeak.output, pm.offpeak.output)
        }
      } else {
        const m = this.pricing.models && this.pricing.models[key]
        if (m) {
          hitAmount = money(b.peak.hit, m.hit) + money(b.offpeak.hit, m.hit)
          missAmount = money(b.peak.miss, m.miss) + money(b.offpeak.miss, m.miss)
          outputAmount = money(b.peak.output, m.output) + money(b.offpeak.output, m.output)
        }
      }
      const hit = (b.peak.hit || 0) + (b.offpeak.hit || 0)
      const miss = (b.peak.miss || 0) + (b.offpeak.miss || 0)
      const out = (b.peak.output || 0) + (b.offpeak.output || 0)
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
        peak: { hit: b.peak.hit || 0, miss: b.peak.miss || 0, output: b.peak.output || 0, count: b.peak.count || 0 },
        offpeak: { hit: b.offpeak.hit || 0, miss: b.offpeak.miss || 0, output: b.offpeak.output || 0, count: b.offpeak.count || 0 },
      })
    }
    return { models, totals }
  }

  async getSessionUsage(args) {
    try {
      const sid = args && args.sessionId ? String(args.sessionId) : ''
      const sessions = this.ctx.get('sessions')
      const sessionQuery = this.ctx.get('sessionQuery')
      let events = []
      // 优先读内存中的 live session：直接取事件数组，开销极小。
      // 只有非 live（已关闭 / 持久化）会话才走 readSession（replay 校验 + 深拷贝，开销大）。
      const live = (sessions && typeof sessions.get === 'function') ? sessions.get(sid) : undefined
      if (live && live.events) {
        events = live.events
      } else if (sessionQuery && typeof sessionQuery.readSession === 'function') {
        try {
          const snapshot = await sessionQuery.readSession(sid)
          events = snapshot.events || []
        } catch (e) {}
      }
      // 缓存：以「事件数组长度 + 最后事件时间戳」为指纹，未变化则直接复用上次计算结果，
      // 避免每 5 秒轮询时重复遍历整份 session log。
      const n = events.length
      const last = n ? events[n - 1] : null
      const key = (last && last.time || '') + ':' + n
      const cached = this.sessionUsageCache[sid]
      if (cached && cached.key === key) {
        return { ok: true, sessionId: sid, models: cloneJson(cached.models), totals: cloneJson(cached.totals), pricing: this.pricing, topUpUrl: TOP_UP_URL }
      }
      const computed = this.computeSessionUsage(events)
      this.sessionUsageCache[sid] = { key, models: computed.models, totals: computed.totals }
      return { ok: true, sessionId: sid, models: computed.models, totals: computed.totals, pricing: this.pricing, topUpUrl: TOP_UP_URL }
    } catch (e) {
      console.error('[dsh-usage-meter] getSessionUsage error: ' + ((e && e.stack) || e))
      return { ok: false, error: String((e && e.message) || e) }
    }
  }

  async getPricing() {
    try { return { ok: true, pricing: this.pricing } } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async setPricing(args) {
    try {
      const next = args && args.pricing
      if (!next || typeof next !== 'object') return { ok: false, error: 'INVALID_CONFIG' }
      this.pricing = mergePricing(next)
      this.sessionUsageCache = {}
      await this.writeJsonFile(PRICING_PATH, this.pricing)
      return { ok: true, pricing: this.pricing }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }
}

// 手动调用 Remote 装饰器函数给实例方法打标，使 gateway 的 SRC fallback
// 能发现这些方法（Node 不支持装饰器语法，只能手动模拟 decorator context）。
const DshUsageMeterServiceProto = DshUsageMeterService.prototype
const REMOTE_METHODS = ['deepseekBalance', 'getSessionUsage', 'getPricing', 'setPricing']
for (const method of REMOTE_METHODS) {
  Remote(DshUsageMeterServiceProto[method], {
    private: false,
    static: false,
    name: method,
    addInitializer(fn) { fn.call(Object.create(DshUsageMeterServiceProto)) },
  })
}

export function apply(ctx) {
  try {
    new DshUsageMeterService(ctx)
  } catch (e) {
    console.error('[dsh-usage-meter] apply FAILED: ' + ((e && e.stack) || e))
  }
}
