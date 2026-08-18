window.__ModuleLoader__.load({
  id: "@hunterchcl/dsh-usage-meter",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require("react")

    // 与宿主一致的 5 个 RPC 描述符（宽松 JSON 编解码，免编译器）
    var JSON_CODEC = { mode: "strict", typeSymbol: "json", schema: { parse: function (v) { return v } } }
    var NS = "dshUsageMeter"
    var PKG = "@hunterchcl/dsh-usage-meter"
    function direct(method, params) {
      return { id: PKG + "#" + NS + "/" + method, service: NS, namespace: NS, method: method, invocation: { kind: "direct" }, parameters: params || [], result: JSON_CODEC }
    }
    function argsParam() { return { name: "args", wire: "args", source: "json", codec: JSON_CODEC } }
    var DESCRIPTORS = [
      direct("deepseekBalance"), direct("getSessionUsage", [argsParam()]),
      direct("getPricing"), direct("setPricing", [argsParam()])
    ]

    var BLUE = "#4d6bfe"
    var TOP_UP_URL = "https://platform.deepseek.com/top_up"

    var CSS = [
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
      '.dsh-input{box-sizing:border-box;min-width:0;background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:8px 12px;color:inherit;font-size:13px;width:100%}',
      '.dsh-select{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:6px 10px;color:inherit;font-size:13px}',
      '.dsh-top-usage{display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.2}',
      '.dsh-top-usage-item{position:relative;display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(127,127,127,.08);border:1px solid rgba(127,127,127,.14);white-space:nowrap}',
      '.dsh-top-label{opacity:.55}',
      '.dsh-top-amount{font-weight:700;font-variant-numeric:tabular-nums;color:' + BLUE + '}',
      '.dsh-top-topup{color:' + BLUE + ';text-decoration:none;border-left:1px solid rgba(127,127,127,.2);padding-left:8px;font-weight:600}',
      '.dsh-top-topup:hover{text-decoration:underline}',
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
      '.dsh-price-note{margin:2px 0 10px}',
      '.dsh-price-row{display:grid;grid-template-columns:110px repeat(3,minmax(0,1fr));gap:8px;align-items:center;padding:4px 0}',
      '.dsh-price-row.dsh-price-head{font-size:11px;opacity:.55}',
      '.dsh-price-label{font-size:12px;opacity:.8}',
      '.dsh-price-window{display:flex;align-items:center;gap:8px;padding:4px 0}',
      '.dsh-time-input{width:110px}',
      '.dsh-check{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 0;cursor:pointer}',
    ].join("\n")

    function el(tag, props) {
      var children = Array.prototype.slice.call(arguments, 2)
      return React.createElement.apply(null, [tag, props].concat(children))
    }

    var remote = null
    async function callHost(method, args) {
      if (!remote) return { ok: false, error: boundT("rpcNotInit") }
      if (typeof remote[method] !== "function") return { ok: false, error: boundT("methodMissing") + method }
      try {
        var r = args === undefined ? await remote[method]() : await remote[method](args)
        if (!r || r.ok !== true) {
          var rawErr = r && r.error
          var msg = (typeof rawErr === "string") ? rawErr : (rawErr && rawErr.message) || boundT("callFailed")
          return { ok: false, error: translateHostError(msg) }
        }
        return r.value || { ok: true }
      } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
    }

    function fmtMoney(v) { return "¥" + Number(v || 0).toFixed(2) }
    function fmtTokens(n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") }
    function fmtNum(v) { return String(v === undefined || v === null ? "" : v) }

    // ===== 国际化（zh / en，随 DSH 语言自动切换） =====
    var ZH = {
      nav: "余额 / 用量",
      rpcNotInit: "RPC 未初始化",
      methodMissing: "方法不存在: ",
      callFailed: "调用失败",
      noUsage: "本会话暂无用量",
      inputHit: "输入（命中缓存）",
      inputMiss: "输入（未命中缓存）",
      output: "输出",
      subtotal: "小计",
      total: "合计",
      balance: "余额",
      topUp: "充值",
      thisSession: "本会话",
      loadPricingFailed: "加载计价设置失败",
      saving: "保存中…",
      saved: "已保存",
      saveFailed: "保存失败",
      loadingPricing: "正在加载计价设置…",
      pricingSettings: "计价设置",
      pricingNote: "单位：元 / 百万 tokens。模型名按 deepseek-v4-flash / deepseek-v4-pro 归集，flash、pro 为别名；未匹配的模型只显示 token 数、不计算金额。",
      model: "模型",
      normalPrice: "普通价",
      peakPrice: "高峰价",
      offpeakPrice: "空闲价",
      enablePeakPricing: "启用峰谷定价（按时段使用不同价格）",
      peakWindowsLabel: "高峰时段（北京时间，其余为空闲）",
      delete: "删除",
      addPeakWindow: "+ 添加高峰时段",
      savePricing: "保存计价设置",
      loadingBalance: "正在查询余额…",
      noBalanceInfo: "未返回余额信息",
      currency: "币种",
      totalBalance: "总余额",
      grantedBalance: "赠送余额",
      toppedUpBalance: "充值余额",
      deepseekBalance: "DeepSeek 余额",
      refresh: "刷新",
      balanceNote: "余额来自 DeepSeek 开放平台 user/balance 接口；仅官方 API 显示余额与充值入口。",
      unknownError: "未知错误",
      hostNoSubprocess: "子进程服务不可用",
      hostNoApiKey: "未配置 DeepSeek API Key（DEEPSEEK_API_KEY）",
      hostNoOutput: "余额请求无输出",
      hostInvalidConfig: "配置无效",
    }
    var EN = {
      nav: "Balance / Usage",
      rpcNotInit: "RPC not initialized",
      methodMissing: "Method not found: ",
      callFailed: "Call failed",
      noUsage: "No usage in this session",
      inputHit: "Input (cache hit)",
      inputMiss: "Input (cache miss)",
      output: "Output",
      subtotal: "Subtotal",
      total: "Total",
      balance: "Balance",
      topUp: "Top up",
      thisSession: "This session",
      loadPricingFailed: "Failed to load pricing settings",
      saving: "Saving…",
      saved: "Saved",
      saveFailed: "Save failed",
      loadingPricing: "Loading pricing settings…",
      pricingSettings: "Pricing Settings",
      pricingNote: "Unit: CNY / million tokens. Model names are grouped as deepseek-v4-flash / deepseek-v4-pro (flash, pro are aliases); unmatched models only show token counts, no amount.",
      model: "Model",
      normalPrice: "Standard price",
      peakPrice: "Peak price",
      offpeakPrice: "Off-peak price",
      enablePeakPricing: "Enable peak/off-peak pricing (different prices by time window)",
      peakWindowsLabel: "Peak windows (Beijing time; the rest is off-peak)",
      delete: "Delete",
      addPeakWindow: "+ Add peak window",
      savePricing: "Save pricing settings",
      loadingBalance: "Querying balance…",
      noBalanceInfo: "No balance info returned",
      currency: "Currency",
      totalBalance: "Total balance",
      grantedBalance: "Granted balance",
      toppedUpBalance: "Topped-up balance",
      deepseekBalance: "DeepSeek Balance",
      refresh: "Refresh",
      balanceNote: "Balance comes from the DeepSeek Open Platform user/balance API; balance and top-up entry are only shown for the official API.",
      unknownError: "Unknown error",
      hostNoSubprocess: "Subprocess service unavailable",
      hostNoApiKey: "DeepSeek API Key (DEEPSEEK_API_KEY) is not configured",
      hostNoOutput: "Balance request returned no output",
      hostInvalidConfig: "Invalid configuration",
    }

    // 模块级 locale 服务与翻译函数：apply 时绑定；locale 插件缺失时回退中文。
    var localeService = null
    var boundT = function (key) { return ZH[key] || key }
    // 组件内使用：订阅 locale 变化，切换语言时强制重渲染。
    function useT() {
      var s = React.useState(0)
      var force = s[1]
      React.useEffect(function () {
        if (!localeService) return undefined
        return localeService.subscribe(function () { force(function (x) { return x + 1 }) })
      }, [])
      return boundT
    }

    // 宿主返回的稳定错误码 → 词典 key（随当前语言翻译）。
    var HOST_ERROR_KEYS = {
      NO_SUBPROCESS: "hostNoSubprocess",
      NO_API_KEY: "hostNoApiKey",
      NO_OUTPUT: "hostNoOutput",
      INVALID_CONFIG: "hostInvalidConfig",
    }
    function translateHostError(msg) {
      var key = HOST_ERROR_KEYS[msg]
      return key ? boundT(key) : msg
    }

    // ===== 顶部余额 / 用量胶囊 =====
    function TopUsageWidget(props) {
      var sessionId = props.sessionId
      var t = useT()
      var bp = React.useState(null)
      var balance = bp[0]
      var setBalance = bp[1]
      var up = React.useState(null)
      var usage = up[0]
      var setUsage = up[1]

      function loadBalance() {
        callHost("deepseekBalance").then(function (res) {
          if (res && res.ok) {
            var b = null
            try { b = JSON.parse(res.body) } catch (e) { b = null }
            setBalance(b)
          } else setBalance(null)
        }).catch(function () { setBalance(null) })
      }
      var loadingRef = React.useRef(false)
      function loadUsage() {
        if (!sessionId || loadingRef.current) return
        loadingRef.current = true
        callHost("getSessionUsage", { sessionId: sessionId }).then(function (res) {
          setUsage((res && res.ok) ? res : null)
          loadingRef.current = false
        }).catch(function () { setUsage(null); loadingRef.current = false })
      }
      React.useEffect(function () {
        loadBalance()
        loadUsage()
        var usageTimer = setInterval(loadUsage, 5000)
        // 余额来自 DeepSeek 官方接口，刷新频率放低一些，避免频繁请求被限流
        var balanceTimer = setInterval(loadBalance, 60000)
        return function () { clearInterval(usageTimer); clearInterval(balanceTimer) }
      }, [sessionId])

      var cny = null
      if (balance && balance.balance_infos) {
        for (var i = 0; i < balance.balance_infos.length; i++) {
          if (balance.balance_infos[i].currency === "CNY") { cny = balance.balance_infos[i]; break }
        }
        if (cny === null) cny = balance.balance_infos[0]
      }

      function renderPop() {
        if (!usage || !usage.models || usage.models.length === 0) {
          return el("div", { className: "dsh-usage-empty" }, t("noUsage"))
        }
        return el("div", {},
          usage.models.map(function (m) {
            return el("div", { className: "dsh-usage-model", key: m.model },
              el("div", { className: "dsh-usage-model-name" }, m.model),
              el("div", { className: "dsh-usage-line" },
                el("span", { className: "dsh-usage-line-label" }, t("inputHit")),
                el("span", { className: "dsh-usage-line-tokens" }, fmtTokens(m.hit) + " tokens"),
                el("span", { className: "dsh-usage-line-amt" }, fmtMoney(m.hitAmount))),
              el("div", { className: "dsh-usage-line" },
                el("span", { className: "dsh-usage-line-label" }, t("inputMiss")),
                el("span", { className: "dsh-usage-line-tokens" }, fmtTokens(m.miss) + " tokens"),
                el("span", { className: "dsh-usage-line-amt" }, fmtMoney(m.missAmount))),
              el("div", { className: "dsh-usage-line" },
                el("span", { className: "dsh-usage-line-label" }, t("output")),
                el("span", { className: "dsh-usage-line-tokens" }, fmtTokens(m.output) + " tokens"),
                el("span", { className: "dsh-usage-line-amt" }, fmtMoney(m.outputAmount))),
              el("div", { className: "dsh-usage-subtotal" },
                el("span", null, t("subtotal")),
                el("span", null, fmtTokens(m.tokens) + " tokens · " + fmtMoney(m.amount))))
          }),
          el("div", { className: "dsh-usage-total" },
            el("span", null, t("total")),
            el("span", null, fmtTokens(usage.totals.tokens) + " tokens · " + fmtMoney(usage.totals.amount))))
      }

      return el("div", { className: "dsh-top-usage" },
        cny !== null && cny !== undefined
          ? el("div", { className: "dsh-top-usage-item dsh-top-balance" },
              el("span", { className: "dsh-top-label" }, t("balance")),
              el("span", { className: "dsh-top-amount" }, fmtMoney(cny.total_balance)),
              el("a", { className: "dsh-top-topup", href: TOP_UP_URL, target: "_blank", rel: "noreferrer" }, t("topUp")))
          : null,
        el("div", { className: "dsh-top-usage-item dsh-top-session" },
          el("span", { className: "dsh-top-label" }, t("thisSession")),
          el("span", { className: "dsh-top-amount" }, usage ? fmtMoney(usage.totals.amount) : "--"),
          el("div", { className: "dsh-usage-pop" }, renderPop()))
      )
    }

    // ===== 计价设置表单 =====
    function pricingModelKeys(pricing) {
      var keys = []
      var seen = {}
      var preferred = ["deepseek-v4-flash", "deepseek-v4-pro"]
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
      return el("input", {
        type: "number",
        min: "0",
        step: "0.01",
        className: "dsh-input",
        value: fmtNum(props.value),
        onChange: function (e) { props.onChange(e.target.value) },
      })
    }

    function PriceRow(props) {
      return el("div", { className: "dsh-price-row" },
        el("span", { className: "dsh-price-label" }, props.label),
        el(PriceInput, { value: props.hit, onChange: props.onHit }),
        el(PriceInput, { value: props.miss, onChange: props.onMiss }),
        el(PriceInput, { value: props.output, onChange: props.onOutput }))
    }

    function PricingEditor() {
      var t = useT()
      var p = React.useState(null)
      var pricing = p[0]
      var setPricing = p[1]
      var sp = React.useState("")
      var status = sp[0]
      var setStatus = sp[1]

      function load() {
        callHost("getPricing").then(function (res) {
          if (res && res.ok) setPricing(res.pricing)
          else setStatus((res && res.error) || t("loadPricingFailed"))
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
          next.peakWindows.push({ start: "09:00", end: "12:00" })
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
        setStatus(t("saving"))
        callHost("setPricing", { pricing: pricing }).then(function (res) {
          if (res && res.ok) { setStatus(t("saved")); load() }
          else setStatus((res && res.error) || t("saveFailed"))
        }).catch(function (e) { setStatus(String((e && e.message) || e)) })
      }

      if (!pricing) return el("div", { className: "dsh-muted" }, t("loadingPricing"))

      var keys = pricingModelKeys(pricing)
      return el("div", { className: "dsh-card" },
        el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, t("pricingSettings")),
        el("div", { className: "dsh-note dsh-price-note" }, t("pricingNote")),
        el("div", { className: "dsh-price-row dsh-price-head" },
          el("span", null, t("model")),
          el("span", null, t("inputHit")),
          el("span", null, t("inputMiss")),
          el("span", null, t("output"))),

        keys.map(function (model) {
          var m = pricing.models[model] || { hit: 0, miss: 0, output: 0 }
          return el("div", { key: model, style: { marginBottom: "10px" } },
            el("div", { className: "dsh-price-label", style: { margin: "8px 0 2px", fontWeight: 600 } }, model),
            el(PriceRow, {
              label: t("normalPrice"),
              hit: m.hit, miss: m.miss, output: m.output,
              onHit: function (v) { setModelPrice(model, "hit", v) },
              onMiss: function (v) { setModelPrice(model, "miss", v) },
              onOutput: function (v) { setModelPrice(model, "output", v) },
            }),
            pricing.peakEnabled
              ? (function () {
                  var pm = pricing.peakModels[model] || { peak: { hit: 0, miss: 0, output: 0 }, offpeak: { hit: 0, miss: 0, output: 0 } }
                  return el("div", {},
                    el(PriceRow, {
                      label: t("peakPrice"),
                      hit: pm.peak.hit, miss: pm.peak.miss, output: pm.peak.output,
                      onHit: function (v) { setPeakPrice(model, "peak", "hit", v) },
                      onMiss: function (v) { setPeakPrice(model, "peak", "miss", v) },
                      onOutput: function (v) { setPeakPrice(model, "peak", "output", v) },
                    }),
                    el(PriceRow, {
                      label: t("offpeakPrice"),
                      hit: pm.offpeak.hit, miss: pm.offpeak.miss, output: pm.offpeak.output,
                      onHit: function (v) { setPeakPrice(model, "offpeak", "hit", v) },
                      onMiss: function (v) { setPeakPrice(model, "offpeak", "miss", v) },
                      onOutput: function (v) { setPeakPrice(model, "offpeak", "output", v) },
                    }))
                })()
              : null)
        }),

        el("label", { className: "dsh-check" },
          el("input", {
            type: "checkbox",
            checked: !!pricing.peakEnabled,
            onChange: function (e) {
              setPricing(function (prev) {
                var next = JSON.parse(JSON.stringify(prev))
                next.peakEnabled = e.target.checked
                return next
              })
            },
          }),
          el("span", null, t("enablePeakPricing"))),

        pricing.peakEnabled
          ? el("div", { style: { marginTop: "8px" } },
              el("div", { className: "dsh-price-label", style: { margin: "6px 0" } }, t("peakWindowsLabel")),
              pricing.peakWindows.map(function (w, i) {
                return el("div", { className: "dsh-price-window", key: i },
                  el("input", { className: "dsh-input dsh-time-input", value: fmtNum(w.start), placeholder: "09:00", onChange: function (e) { setWindow(i, "start", e.target.value) } }),
                  el("span", null, "—"),
                  el("input", { className: "dsh-input dsh-time-input", value: fmtNum(w.end), placeholder: "12:00", onChange: function (e) { setWindow(i, "end", e.target.value) } }),
                  el("button", { className: "dsh-btn ghost", onClick: function () { removeWindow(i) } }, t("delete")))
              }),
              el("button", { className: "dsh-btn ghost", style: { marginTop: "6px" }, onClick: addWindow }, t("addPeakWindow")))
          : null,

        el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" } },
          el("button", { className: "dsh-btn", onClick: save }, t("savePricing")),
          status ? el("span", { className: status === t("saved") ? "dsh-ok" : "dsh-muted" }, status) : null)
      )
    }

    // ===== 设置页：余额 / 用量 =====
    function BalanceSection() {
      var t = useT()
      var p = React.useState({ status: "idle" })
      var state = p[0]
      var setState = p[1]
      function load() {
        setState({ status: "loading" })
        callHost("deepseekBalance").then(function (res) {
          if (res && res.ok) {
            var balance = null
            try { balance = JSON.parse(res.body) } catch (e) { balance = null }
            setState({ status: "ok", balance: balance })
          } else {
            setState({ status: "error", error: (res && res.error) || t("unknownError") })
          }
        }).catch(function (e) {
          setState({ status: "error", error: String((e && e.message) || e) })
        })
      }
      React.useEffect(function () { load() }, [])

      var body
      if (state.status === "loading") {
        body = el("div", { className: "dsh-muted" }, t("loadingBalance"))
      } else if (state.status === "error") {
        body = el("div", { className: "dsh-err" }, state.error)
      } else if (state.status === "ok" && state.balance) {
        var infos = (state.balance.balance_infos) || []
        if (infos.length === 0) {
          body = el("div", { className: "dsh-muted" }, t("noBalanceInfo"))
        } else {
          body = infos.map(function (info) {
            return el("div", { className: "dsh-card", key: info.currency },
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, t("currency")), el("span", { className: "dsh-value" }, info.currency)),
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, t("totalBalance")), el("span", { className: "dsh-amount" }, info.total_balance)),
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, t("grantedBalance")), el("span", { className: "dsh-value" }, info.granted_balance)),
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, t("toppedUpBalance")), el("span", { className: "dsh-value" }, info.topped_up_balance)))
          })
        }
      }

      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" },
          el("h2", { className: "dsh-h2" }, t("deepseekBalance")),
          el("button", { className: "dsh-btn ghost", onClick: load }, t("refresh"))),
        body,
        el(PricingEditor),
        el("div", { className: "dsh-muted" }, t("balanceNote")))
    }

    async function apply(ctx) {
      await ctx.remote.$mount({ package: PKG, descriptors: DESCRIPTORS })

      var holder = { service: null }
      await ctx.plugin({
        name: "dsh-usage-meter-ns",
        inject: ["remote.dshUsageMeter"],
        apply: function (c) { holder.service = c.remote.dshUsageMeter }
      })
      remote = holder.service

      // 国际化：注册中英词典并绑定翻译函数（随 DSH 语言自动切换）
      if (ctx.locale && typeof ctx.locale.register === "function") {
        localeService = ctx.locale
        if (typeof ctx.effect === "function") {
          ctx.effect(function () { return ctx.locale.register(NS, { zh: ZH, en: EN }) }, "dsh-usage-meter: dictionaries")
        } else {
          ctx.locale.register(NS, { zh: ZH, en: EN })
        }
        boundT = ctx.locale.bind(NS)
      }

      if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=dsh-usage-meter]") === null) {
        var tag = document.createElement("style")
        tag.dataset.pluginCss = "dsh-usage-meter"
        tag.textContent = CSS
        document.head.appendChild(tag)
      }

      var slots = ctx.slots

      slots.inject("conversation.session.header.utilities", function () {
        return slots.register(
          { name: "conversation.session.header.utilities", id: "dsh-usage-meter-top", order: -10, label: function () { return boundT("nav") } },
          function (props) { return React.createElement(TopUsageWidget, props) }
        )
      })

      slots.inject("settings.section", function () {
        return slots.register(
          { name: "settings.section", id: "dsh-usage-meter", order: 30, label: function () { return boundT("nav") } },
          function () { return React.createElement(BalanceSection) }
        )
      })
    }

    exports.apply = apply
    exports.inject = ["remote", "slots", "locale"]
    return module.exports
  }
})
