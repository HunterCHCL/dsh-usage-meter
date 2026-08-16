// dsh-usage-meter 客户端侧（动态插件函数体，由 index.js 通过 dynamicCordisRunner 加载）
// 功能：会话顶部余额/用量胶囊（hover 显示模型级明细）+ 设置页「余额 / 用量」与计价配置。
function el(tag, props) {
  var children = Array.prototype.slice.call(arguments, 2)
  return React.createElement.apply(null, [tag, props].concat(children))
}

var BLUE = '#4d6bfe'
var TOP_UP_URL = 'https://platform.deepseek.com/top_up'
var timerApi = null

var CSS = [
  // 页面通用
  '.dsh-page{padding:20px;display:flex;flex-direction:column;gap:16px}',
  '.dsh-head{display:flex;justify-content:space-between;align-items:center}',
  '.dsh-h2{margin:0;font-size:15px;font-weight:600}',
  '.dsh-card{background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.16);border-radius:12px;padding:16px}',
  '.dsh-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}',
  '.dsh-row+.dsh-row{border-top:1px solid rgba(127,127,127,.10)}',
  '.dsh-label{opacity:.62;font-size:13px}',
  '.dsh-value{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}',
  '.dsh-amount{font-size:24px;font-weight:700;color:' + BLUE + '}',
  '.dsh-btn{background:' + BLUE + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer}',
  '.dsh-btn:disabled{opacity:.5;cursor:default}',
  '.dsh-btn.ghost{background:transparent;color:' + BLUE + ';border:1px solid ' + BLUE + '}',
  '.dsh-err{color:#e5484d;font-size:13px}',
  '.dsh-ok{color:#30a46c;font-size:13px}',
  '.dsh-muted{opacity:.6;font-size:13px;line-height:1.5}',
  '.dsh-note{opacity:.45;font-size:11px;line-height:1.5;color:inherit}',
  '.dsh-input{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:8px 12px;color:inherit;font-size:13px;width:100%}',
  '.dsh-select{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:6px 10px;color:inherit;font-size:13px}',
  // 顶部胶囊
  '.dsh-top-usage{display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.2}',
  '.dsh-top-usage-item{position:relative;display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(127,127,127,.08);border:1px solid rgba(127,127,127,.14);white-space:nowrap}',
  '.dsh-top-label{opacity:.55}',
  '.dsh-top-amount{font-weight:700;font-variant-numeric:tabular-nums;color:' + BLUE + '}',
  '.dsh-top-topup{color:' + BLUE + ';text-decoration:none;border-left:1px solid rgba(127,127,127,.2);padding-left:8px;font-weight:600}',
  '.dsh-top-topup:hover{text-decoration:underline}',
  // 悬浮明细
  '.dsh-usage-pop{display:none;position:absolute;right:0;top:calc(100% + 8px);width:360px;max-height:440px;overflow:auto;background:#181a20;border:1px solid rgba(127,127,127,.25);border-radius:12px;padding:12px;z-index:9999;box-shadow:0 12px 32px rgba(0,0,0,.45);color:#e8e8e8}',
  '.dsh-top-usage-item:hover .dsh-usage-pop{display:block}',
  '.dsh-usage-empty{opacity:.6;font-size:12px;padding:6px 2px}',
  '.dsh-usage-model{padding:8px 0;border-bottom:1px solid rgba(127,127,127,.12)}',
  '.dsh-usage-model:first-child{padding-top:2px}',
  '.dsh-usage-model-name{font-weight:700;font-size:13px;margin-bottom:6px;color:#fff}',
  '.dsh-usage-line{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0;font-size:12px}',
  '.dsh-usage-line-label{opacity:.62}',
  '.dsh-usage-line-tokens{opacity:.8;font-variant-numeric:tabular-nums;flex:1;text-align:right}',
  '.dsh-usage-line-amt{width:86px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:#7c9aff}',
  '.dsh-usage-subtotal{display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(127,127,127,.15);font-size:12px;font-weight:600}',
  '.dsh-usage-total{display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid rgba(127,127,127,.25);font-size:13px;font-weight:700}',
  // 计价设置
  '.dsh-price-note{margin:2px 0 10px}',
  '.dsh-price-row{display:grid;grid-template-columns:110px 1fr 1fr 1fr;gap:8px;align-items:center;padding:4px 0}',
  '.dsh-price-row.dsh-price-head{font-size:11px;opacity:.55}',
  '.dsh-price-label{font-size:12px;opacity:.8}',
  '.dsh-price-window{display:flex;align-items:center;gap:8px;padding:4px 0}',
  '.dsh-time-input{width:110px}',
  '.dsh-check{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 0;cursor:pointer}',
].join('\n')

function fmtMoney(v) { return '¥' + Number(v || 0).toFixed(2) }
function fmtTokens(n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function fmtNum(v) { return String(v === undefined || v === null ? '' : v) }

// ===== 顶部余额 / 用量胶囊 =====
function TopUsageWidget(props) {
  var sessionId = props.sessionId
  var bp = React.useState(null)
  var balance = bp[0]
  var setBalance = bp[1]
  var up = React.useState(null)
  var usage = up[0]
  var setUsage = up[1]

  function loadBalance() {
    host.call('deepseek-balance').then(function (res) {
      if (res && res.ok) {
        var b = null
        try { b = JSON.parse(res.body) } catch (e) { b = null }
        setBalance(b)
      } else {
        setBalance(null)
      }
    }).catch(function () { setBalance(null) })
  }
  function loadUsage() {
    if (!sessionId) return
    host.call('get-session-usage', { sessionId: sessionId }).then(function (res) {
      setUsage((res && res.ok) ? res : null)
    }).catch(function () { setUsage(null) })
  }
  React.useEffect(function () {
    loadBalance()
    loadUsage()
    var dispose = null
    if (timerApi) {
      dispose = timerApi(function () { loadUsage() }, 3000)
    }
    return function () { if (dispose) dispose() }
  }, [sessionId])

  var cny = null
  if (balance && balance.balance_infos) {
    for (var i = 0; i < balance.balance_infos.length; i++) {
      if (balance.balance_infos[i].currency === 'CNY') { cny = balance.balance_infos[i]; break }
    }
    if (cny === null) cny = balance.balance_infos[0]
  }

  function renderPop() {
    if (!usage || !usage.models || usage.models.length === 0) {
      return el('div', { className: 'dsh-usage-empty' }, '本会话暂无用量')
    }
    return el('div', {},
      usage.models.map(function (m) {
        return el('div', { className: 'dsh-usage-model', key: m.model },
          el('div', { className: 'dsh-usage-model-name' }, m.model),
          el('div', { className: 'dsh-usage-line' },
            el('span', { className: 'dsh-usage-line-label' }, '输入（命中缓存）'),
            el('span', { className: 'dsh-usage-line-tokens' }, fmtTokens(m.hit) + ' tokens'),
            el('span', { className: 'dsh-usage-line-amt' }, fmtMoney(m.hitAmount))),
          el('div', { className: 'dsh-usage-line' },
            el('span', { className: 'dsh-usage-line-label' }, '输入（未命中缓存）'),
            el('span', { className: 'dsh-usage-line-tokens' }, fmtTokens(m.miss) + ' tokens'),
            el('span', { className: 'dsh-usage-line-amt' }, fmtMoney(m.missAmount))),
          el('div', { className: 'dsh-usage-line' },
            el('span', { className: 'dsh-usage-line-label' }, '输出'),
            el('span', { className: 'dsh-usage-line-tokens' }, fmtTokens(m.output) + ' tokens'),
            el('span', { className: 'dsh-usage-line-amt' }, fmtMoney(m.outputAmount))),
          el('div', { className: 'dsh-usage-subtotal' },
            el('span', null, '小计'),
            el('span', null, fmtTokens(m.tokens) + ' tokens · ' + fmtMoney(m.amount))))
      }),
      el('div', { className: 'dsh-usage-total' },
        el('span', null, '合计'),
        el('span', null, fmtTokens(usage.totals.tokens) + ' tokens · ' + fmtMoney(usage.totals.amount))))
  }

  return el('div', { className: 'dsh-top-usage' },
    cny !== null && cny !== undefined
      ? el('div', { className: 'dsh-top-usage-item dsh-top-balance' },
          el('span', { className: 'dsh-top-label' }, '余额'),
          el('span', { className: 'dsh-top-amount' }, fmtMoney(cny.total_balance)),
          el('a', { className: 'dsh-top-topup', href: TOP_UP_URL, target: '_blank', rel: 'noreferrer' }, '充值'))
      : null,
    el('div', { className: 'dsh-top-usage-item dsh-top-session' },
      el('span', { className: 'dsh-top-label' }, '本会话'),
      el('span', { className: 'dsh-top-amount' }, usage ? fmtMoney(usage.totals.amount) : '--'),
      el('div', { className: 'dsh-usage-pop' }, renderPop()))
  )
}

// ===== 计价设置表单 =====
function pricingModelKeys(pricing) {
  var keys = []
  var seen = {}
  var preferred = ['deepseek-v4-flash', 'deepseek-v4-pro']
  preferred.forEach(function (k) {
    if ((pricing.models && pricing.models[k]) || (pricing.peakModels && pricing.peakModels[k])) { keys.push(k); seen[k] = true }
  })
  var maps = [pricing.models, pricing.peakModels]
  maps.forEach(function (map) {
    if (!map) return
    for (var k in map) {
      if (!seen[k]) { keys.push(k); seen[k] = true }
    }
  })
  return keys
}

function PriceInput(props) {
  return el('input', {
    type: 'number',
    min: '0',
    step: '0.01',
    className: 'dsh-input',
    value: fmtNum(props.value),
    onChange: function (e) { props.onChange(e.target.value) },
  })
}

function PriceRow(props) {
  return el('div', { className: 'dsh-price-row' },
    el('span', { className: 'dsh-price-label' }, props.label),
    el(PriceInput, { value: props.hit, onChange: props.onHit }),
    el(PriceInput, { value: props.miss, onChange: props.onMiss }),
    el(PriceInput, { value: props.output, onChange: props.onOutput }))
}

function PricingEditor() {
  var p = React.useState(null)
  var pricing = p[0]
  var setPricing = p[1]
  var sp = React.useState('')
  var status = sp[0]
  var setStatus = sp[1]

  function load() {
    host.call('get-pricing').then(function (res) {
      if (res && res.ok) setPricing(res.pricing)
      else setStatus((res && res.error) || '加载计价设置失败')
    }).catch(function (e) { setStatus(String((e && e.message) || e)) })
  }
  React.useEffect(function () { load() }, [])

  function setModelPrice(model, field, value) {
    setPricing(function (prev) {
      var next = JSON.parse(JSON.stringify(prev))
      if (!next.models[model]) next.models[model] = { hit: 0, miss: 0, output: 0 }
      next.models[model][field] = value
      return next
    })
  }
  function setPeakPrice(model, which, field, value) {
    setPricing(function (prev) {
      var next = JSON.parse(JSON.stringify(prev))
      if (!next.peakModels[model]) next.peakModels[model] = { peak: { hit: 0, miss: 0, output: 0 }, offpeak: { hit: 0, miss: 0, output: 0 } }
      next.peakModels[model][which][field] = value
      return next
    })
  }
  function setWindow(i, field, value) {
    setPricing(function (prev) {
      var next = JSON.parse(JSON.stringify(prev))
      if (next.peakWindows[i]) next.peakWindows[i][field] = value
      return next
    })
  }
  function addWindow() {
    setPricing(function (prev) {
      var next = JSON.parse(JSON.stringify(prev))
      next.peakWindows.push({ start: '09:00', end: '12:00' })
      return next
    })
  }
  function removeWindow(i) {
    setPricing(function (prev) {
      var next = JSON.parse(JSON.stringify(prev))
      next.peakWindows.splice(i, 1)
      return next
    })
  }
  function save() {
    setStatus('保存中…')
    host.call('set-pricing', { pricing: pricing }).then(function (res) {
      if (res && res.ok) { setStatus('已保存'); load() }
      else setStatus((res && res.error) || '保存失败')
    }).catch(function (e) { setStatus(String((e && e.message) || e)) })
  }

  if (!pricing) return el('div', { className: 'dsh-muted' }, '正在加载计价设置…')

  var keys = pricingModelKeys(pricing)
  return el('div', { className: 'dsh-card' },
    el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '计价设置'),
    el('div', { className: 'dsh-note dsh-price-note' }, '单位：元 / 百万 tokens。模型名按 deepseek-v4-flash / deepseek-v4-pro 归集，flash、pro 为别名；未匹配的模型只显示 token 数、不计算金额。'),
    el('div', { className: 'dsh-price-row dsh-price-head' },
      el('span', null, '模型'),
      el('span', null, '输入（命中缓存）'),
      el('span', null, '输入（未命中缓存）'),
      el('span', null, '输出')),

    keys.map(function (model) {
      var m = pricing.models[model] || { hit: 0, miss: 0, output: 0 }
      return el('div', { key: model, style: { marginBottom: '10px' } },
        el('div', { className: 'dsh-price-label', style: { margin: '8px 0 2px', fontWeight: 600 } }, model),
        el(PriceRow, {
          label: '普通价',
          hit: m.hit, miss: m.miss, output: m.output,
          onHit: function (v) { setModelPrice(model, 'hit', v) },
          onMiss: function (v) { setModelPrice(model, 'miss', v) },
          onOutput: function (v) { setModelPrice(model, 'output', v) },
        }),
        pricing.peakEnabled
          ? (function () {
              var pm = pricing.peakModels[model] || { peak: { hit: 0, miss: 0, output: 0 }, offpeak: { hit: 0, miss: 0, output: 0 } }
              return el('div', {},
                el(PriceRow, {
                  label: '高峰价',
                  hit: pm.peak.hit, miss: pm.peak.miss, output: pm.peak.output,
                  onHit: function (v) { setPeakPrice(model, 'peak', 'hit', v) },
                  onMiss: function (v) { setPeakPrice(model, 'peak', 'miss', v) },
                  onOutput: function (v) { setPeakPrice(model, 'peak', 'output', v) },
                }),
                el(PriceRow, {
                  label: '空闲价',
                  hit: pm.offpeak.hit, miss: pm.offpeak.miss, output: pm.offpeak.output,
                  onHit: function (v) { setPeakPrice(model, 'offpeak', 'hit', v) },
                  onMiss: function (v) { setPeakPrice(model, 'offpeak', 'miss', v) },
                  onOutput: function (v) { setPeakPrice(model, 'offpeak', 'output', v) },
                }))
            })()
          : null)
    }),

    el('label', { className: 'dsh-check' },
      el('input', {
        type: 'checkbox',
        checked: !!pricing.peakEnabled,
        onChange: function (e) {
          setPricing(function (prev) {
            var next = JSON.parse(JSON.stringify(prev))
            next.peakEnabled = e.target.checked
            return next
          })
        },
      }),
      el('span', null, '启用峰谷定价（按时段使用不同价格）')),

    pricing.peakEnabled
      ? el('div', { style: { marginTop: '8px' } },
          el('div', { className: 'dsh-price-label', style: { margin: '6px 0' } }, '高峰时段（北京时间，其余为空闲）'),
          pricing.peakWindows.map(function (w, i) {
            return el('div', { className: 'dsh-price-window', key: i },
              el('input', { className: 'dsh-input dsh-time-input', value: fmtNum(w.start), placeholder: '09:00', onChange: function (e) { setWindow(i, 'start', e.target.value) } }),
              el('span', null, '—'),
              el('input', { className: 'dsh-input dsh-time-input', value: fmtNum(w.end), placeholder: '12:00', onChange: function (e) { setWindow(i, 'end', e.target.value) } }),
              el('button', { className: 'dsh-btn ghost', onClick: function () { removeWindow(i) } }, '删除'))
          }),
          el('button', { className: 'dsh-btn ghost', style: { marginTop: '6px' }, onClick: addWindow }, '+ 添加高峰时段'))
      : null,

    el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' } },
      el('button', { className: 'dsh-btn', onClick: save }, '保存计价设置'),
      status ? el('span', { className: status === '已保存' ? 'dsh-ok' : 'dsh-muted' }, status) : null)
  )
}

// ===== 设置页：余额 / 用量 =====
function BalanceSection() {
  var p = React.useState({ status: 'idle' })
  var state = p[0]
  var setState = p[1]
  var up = React.useState(null)
  var usage = up[0]
  var setUsage = up[1]
  function load() {
    setState({ status: 'loading' })
    host.call('deepseek-balance').then(function (res) {
      if (res && res.ok) {
        var balance = null
        try { balance = JSON.parse(res.body) } catch (e) { balance = null }
        setState({ status: 'ok', balance: balance })
      } else {
        setState({ status: 'error', error: (res && res.error) || '未知错误' })
      }
    }).catch(function (e) {
      setState({ status: 'error', error: String((e && e.message) || e) })
    })
    host.call('get-usage').then(function (res) {
      setUsage((res && res.ok) ? res : null)
    }).catch(function () { setUsage(null) })
  }
  React.useEffect(function () { load() }, [])

  var body
  if (state.status === 'loading') {
    body = el('div', { className: 'dsh-muted' }, '正在查询余额…')
  } else if (state.status === 'error') {
    body = el('div', { className: 'dsh-err' }, state.error)
  } else if (state.status === 'ok' && state.balance) {
    var infos = (state.balance.balance_infos) || []
    if (infos.length === 0) {
      body = el('div', { className: 'dsh-muted' }, '未返回余额信息')
    } else {
      body = infos.map(function (info) {
        return el('div', { className: 'dsh-card', key: info.currency },
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '币种'), el('span', { className: 'dsh-value' }, info.currency)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '总余额'), el('span', { className: 'dsh-amount' }, info.total_balance)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '赠送余额'), el('span', { className: 'dsh-value' }, info.granted_balance)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '充值余额'), el('span', { className: 'dsh-value' }, info.topped_up_balance)))
      })
    }
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, 'DeepSeek 余额'),
      el('button', { className: 'dsh-btn ghost', onClick: load }, '刷新')),
    body,
    el('div', { className: 'dsh-card' },
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '本机 token 用量'),
      usage ? el('div', {},
        el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '本次 token'), el('span', { className: 'dsh-value' }, usage.currentTokens)),
        el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '累计 token'), el('span', { className: 'dsh-value' }, usage.totalTokens)),
        el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '会话数'), el('span', { className: 'dsh-value' }, usage.sessionCount)))
        : el('div', { className: 'dsh-muted' }, '暂无数据'),
      el('div', { className: 'dsh-note', style: { marginTop: '8px' } }, '· 用量为本地估算值，仅供参考，非平台账单；以 DeepSeek 开放平台为准。'),
      el('div', { className: 'dsh-note' }, '· 顶部胶囊显示「本会话」金额，鼠标悬停可查看 模型 × 命中/未命中/输出 明细。')),
    el(PricingEditor),
    el('div', { className: 'dsh-muted' }, '余额来自 DeepSeek 开放平台 user/balance 接口；仅官方 API 显示余额与充值入口。'))
}

return {
  inject: ['timer'],
  apply(ctx) {
    var slots = ctx.get('slots')
    if (slots === undefined) return
    if (timerApi === null && ctx.interval !== undefined) timerApi = ctx.interval.bind(ctx)
    styles.insert(CSS)

    // 会话顶部：余额 + 本会话用量
    slots.inject('conversation.session.header.utilities', function () {
      return slots.register(
        { name: 'conversation.session.header.utilities', id: 'dsh-usage-meter-top', order: -10, label: '余额 / 用量' },
        function (props) { return React.createElement(TopUsageWidget, props) }
      )
    })

    // 设置页
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-usage-meter', order: 30, label: '余额 / 用量' },
        function () { return React.createElement(BalanceSection) }
      )
    })
  },
}
