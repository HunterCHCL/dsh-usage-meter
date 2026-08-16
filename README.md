# dsh-usage-meter

English | [中文](README.zh.md)

Want to see your account balance? Want to know how much a single sentence costs you, without a pile of analytics features? **Want to see how much a price hike hits your wallet?** This plugin is for you.

It shows your DeepSeek official API balance and the amount spent in the current session in the top-right corner of the interface; hover over the amount to see the details. The price table and peak/off-peak pricing are configurable on the settings page.

> **UI language**: All UI copy follows the language selected in DSH (中文 / English). Switch it live in DSH Settings → General → Language; when unset, it follows your browser language.

## Features

- Session header indicator:
  - Balance: calls the official DeepSeek `GET https://api.deepseek.com/user/balance`; hidden for non-official APIs / missing key / failed queries.
  - This session: shows the amount used by the current session (CNY, 2 decimals). Hover for details. UI: <img width="577" height="321" alt="image" src="https://github.com/user-attachments/assets/119c5da4-76db-4655-a26e-9a4ed08d1e2f" />

- Settings page "Balance / Usage": balance details plus **pricing settings**:
  - A peak/off-peak pricing toggle. When enabled, every request is priced by the time window it occurred in, giving accurate amounts even when a conversation spans peak and off-peak windows.
  - <img width="584" height="326" alt="image" src="https://github.com/user-attachments/assets/8aaa7332-59f7-409d-9081-f14a6b4a17c1" />
  (Same conversation as above, but with the peak/off-peak toggle on. Pricing the whole conversation with either the peak or the off-peak rate alone would be wrong, because it spans both windows.)
  - Usage is priced by the window at the **time the request occurred**; only the official API is supported for now. Unmatched models only show token counts, not amounts.

## Layout

```
dsh-usage-meter/
  package.json     plugin package declaration
  cordis.patch.yml bundle patch: mounts this plugin as a Cordis host plugin
  host.js          host ESM: TypertRemoteService RPC (balance/usage/pricing)
  client.js        client static module: header pill + settings page (bilingual, follows DSH language)
  install.ps1      one-click install
  uninstall.ps1    one-click uninstall
  README.md        English docs
  README.zh.md     Chinese docs
```

## Install
**1. Direct install:**

Clone this repo locally, then run its `install.ps1`:
```powershell
cd <plugin directory>
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
**2. Install via npm:**

Run in PowerShell:
```
dsh plugin --profile web add @hunterchcl/dsh-usage-meter
```
Requires pnpm and dsh to be installed.

## Uninstall
Run `uninstall.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1            # keep local data
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveData # also delete usage/pricing data
```
Or via pnpm:
```
dsh plugin --profile web remove @hunterchcl/dsh-usage-meter
```

## Notes & Limitations

- Usage is a local estimate (based on persisted usage records in the DSH session event log: `assistant/chunk` and `assistant/message`), for reference only — not a platform bill; the DeepSeek Open Platform is authoritative.
- Opening a session computes its full historical usage (including records from before this plugin was installed), priced by the peak/off-peak window at the time each request occurred.
- If you later run `pnpm install` manually in the profile directory, it may clean up local plugin directories not declared in `dependencies`; if that happens, re-run `install.ps1`.
- This project is open source under the MIT license. You may freely distribute and modify it, but must retain the original copyright and license text.
