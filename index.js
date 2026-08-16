// dsh-usage-meter 宿主入口（ESM bundle 插件）
// 通过 dynamicCordisRunner 在每个会话创建时加载 host-body.js + client-body.js，
// 零外部依赖（仅用 Node 内置模块与 DSH 提供的 dynamicCordisRunner 服务）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'

const dir = dirname(fileURLToPath(import.meta.url))
const dshHome = process.env.DSH_HOME || join(os.homedir(), '.dsh')
const hostCode = readFileSync(join(dir, 'host-body.js'), 'utf8').split('__DSH_HOME__').join(JSON.stringify(dshHome))
const clientCode = readFileSync(join(dir, 'client-body.js'), 'utf8')

export const inject = ['dynamicCordisRunner']

export function apply(ctx) {
  const runner = ctx.dynamicCordisRunner
  console.log('[dsh-usage-meter] apply: runner=' + (runner === undefined ? 'absent' : 'present'))
  if (runner === undefined) return
  const loaded = new Set()

  async function loadForAgent(agent) {
    const sid = agent && agent.id
    if (sid === undefined || loaded.has(sid)) return
    loaded.add(sid)
    console.log('[dsh-usage-meter] loadForAgent session=' + sid)
    try {
      const receipt = runner.define({
        sessionId: sid,
        plugin: { kind: 'new', idPrefix: 'dshum' },
        name: 'DSH 余额用量',
        purpose: '顶部余额/本会话用量/计价设置',
        code: { host: hostCode, client: clientCode },
      })
      console.log('[dsh-usage-meter] defined plugin=' + receipt.pluginId + ' pkg=' + receipt.packageId)
      const res = await runner.run(agent, receipt.pluginId, receipt.packageId, 'run')
      console.log('[dsh-usage-meter] run status=' + (res && res.ok ? res.status : ('fail ' + (res && res.reason))))
      if (res && res.ok && res.status === 'awaiting-approval') {
        const insp = runner.inspectPlugin(agent, receipt.pluginId)
        const approvalId = insp && insp.latestRun && insp.latestRun.approvalRequestId
        console.log('[dsh-usage-meter] approval id=' + approvalId)
        if (approvalId) {
          const hh = await runner.runHostHalf(agent, receipt.pluginId, receipt.packageId, 'run', approvalId, true)
          console.log('[dsh-usage-meter] runHostHalf ok=' + (hh && hh.ok) + ' runId=' + (hh && hh.pluginRunId))
        }
      }
    } catch (e) {
      console.error('[dsh-usage-meter] load failed: ' + ((e && e.message) || e))
    }
  }

  ctx.on('agent/created', function (payload) {
    console.log('[dsh-usage-meter] agent/created fired')
    if (payload && payload.agent) loadForAgent(payload.agent)
  })
}
