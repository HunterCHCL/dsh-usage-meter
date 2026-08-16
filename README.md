# dsh-usage-meter

DeepSeek Harness（DSH）**静态 bundle 插件**：在界面上方显示 **DeepSeek 官方余额**（含充值入口）和 **本会话已使用额度**；鼠标悬停额度可查看按 **模型 × 输入(命中缓存) / 输入(未命中缓存) / 输出** 细分的 token 数与人民币金额（精确到分）。价格表与峰谷定价可在设置页配置。

> v1.1.0 起改为静态 bundle（宿主 ESM + `dsh.client` 静态客户端），**不再使用 dynamicCordisRunner，因此打开新对话无需逐会话审批，也不会给 AI 注入 cordis 运行日志。**

## 功能

- 会话顶部胶囊：
  - 余额：调用 DeepSeek 官方 `GET https://api.deepseek.com/user/balance`，仅当查询成功（官方 API）时显示余额和「充值」按钮（跳转 `https://platform.deepseek.com/top_up`）；非官方 API / 未配置 Key / 查询失败时余额区域隐藏。
  - 本会话：显示当前 session 已使用额度（人民币，两位小数）。鼠标悬停显示明细：
    ```
    deepseek-v4-flash
      输入（命中缓存）     1,234 tokens   ¥0.02
      输入（未命中缓存）   5,000 tokens   ¥5.00
      输出                800 tokens     ¥1.60
      小计                7,034 tokens · ¥6.62
    合计                  7,034 tokens · ¥6.62
    ```
- 设置页「余额 / 用量」：余额详情、以及 **计价设置**：
  - 普通价格表（默认官方价，单位 元/百万 tokens）：
    - `deepseek-v4-flash`：命中缓存 0.02，未命中 1，输出 2
    - `deepseek-v4-pro`：命中缓存 0.025，未命中 3，输出 6
  - 峰谷定价开关（默认关闭），默认高峰时段为北京时间 `09:00–12:00`、`14:00–18:00`（其余空闲）；高峰/空闲价格可配置，默认：
    - `deepseek-v4-flash`：高峰 0.10 / 3.0 / 9.0，空闲 0.05 / 1.5 / 4.5
    - `deepseek-v4-pro`：高峰 0.30 / 9.0 / 27.0，空闲 0.15 / 4.5 / 13.5
  - 已发生的用量按 **请求发生时刻** 所在时段计价；模型名 `flash` / `pro` 会归一为 `deepseek-v4-flash` / `deepseek-v4-pro`；未匹配价格表的模型只显示 token 数、不计金额。
- API Key 全程不读取、不打印、不存储：仅通过 DSH 的 `credentials.resolve('DEEPSEEK_API_KEY')` 取出后注入子进程环境用于余额请求，绝不出现在浏览器侧。

## 目录

```
dsh-usage-meter/
  package.json     插件包声明（dsh.bundle.patch + dsh.client）
  cordis.patch.yml bundle patch：把本插件挂载为 Cordis 宿主插件
  host.js          宿主 ESM：TypertRemoteService RPC（余额/用量/计价）
  client.js        客户端静态模块：顶部胶囊 + 设置页
  install.ps1      一键安装
  uninstall.ps1    一键卸载
  README.md
```

## 安装

```powershell
cd <本插件目录>
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

脚本会：
1. 自动定位 DSH_HOME（`$env:DSH_HOME`，默认 `~\.dsh`）；
2. 备份 `profiles\web\package.json`；
3. 把 `package.json`、`cordis.patch.yml`、`host.js`、`client.js` 复制到 `profiles\web\node_modules\dsh-usage-meter\`；
4. 在 `profiles\web\package.json` 的 `dsh.profile.bundles` 中加入 `dsh-usage-meter`。

**生效方式**：重启 DSH web。静态 bundle 在 profile 启动时挂载，打开新对话无需审批。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1            # 保留本机数据
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveData # 同时删除用量/计价数据
```

## 数据文件

- `$DSH_HOME\dsh-client-usage.json`：各会话按模型/峰谷桶聚合的 token 明细
- `$DSH_HOME\dsh-client-pricing.json`：价格表与峰谷配置

## 说明与限制

- 用量为本地统计（基于 DSH session 事件日志中持久化的 usage 记录：`assistant/chunk` 与 `assistant/message`），仅供参考，非平台账单；以 DeepSeek 开放平台为准。
- 打开会话即可计算该会话完整历史用量（包括安装本插件之前的记录），按请求发生时刻的峰谷时段计价。
- 若以后在 profile 目录手动运行 `pnpm install`，可能会清理未在 `dependencies` 中声明的本地插件目录；如遇此情况请重新运行 `install.ps1`。
