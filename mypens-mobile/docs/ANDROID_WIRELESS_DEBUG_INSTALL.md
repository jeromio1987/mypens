# Android wireless debug install (myPENS mobile)

Durable runbook for installing a **debuggable** build on Jerome’s OnePlus 12R over Wi‑Fi. Use this instead of trial-and-error.

**Package:** `com.mypens.mobile`  
**Device model (Expo `--device`):** `CPH2609`  
**Do not scan the LAN** for the phone — ask Jerome for the current `IP:port` from the phone’s Wireless debugging screen.

---

## Prerequisites checklist

- [ ] Phone and PC on the same Wi‑Fi (typical: phone `192.168.0.123`, PC `192.168.0.235`)
- [ ] Phone → **Developer options** → **Wireless debugging** ON
- [ ] User pastes **connect** `IP:port` (not the pairing port) — port **rotates every session**
- [ ] Android SDK platform-tools installed (ADB often **not** on PATH)
- [ ] Android Studio JBR present for `JAVA_HOME`
- [ ] Metro (8081) and Next/API (5000) will be running after install
- [ ] Need **debug** APK — release cannot Metro-reload; shake/dev menu fails on non-debuggable builds

### Fixed env paths (this machine)

| Var | Value |
|-----|--------|
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | `C:\Users\jerom\AppData\Local\Android\Sdk` |
| ADB | `C:\Users\jerom\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` |
| `GRADLE_USER_HOME` | `C:\g` (**short** — see Windows 260 failure below) |

---

## PowerShell sequence (copy-paste)

Run from `mypens-mobile` root. Replace `PHONE_IP_PORT` with the value Jerome pastes (e.g. `192.168.0.123:41234`).

```powershell
# --- 0) Env (every new shell) ---
$env:ANDROID_HOME     = "C:\Users\jerom\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME        = "C:\Program Files\Android\Android Studio\jbr"
$env:GRADLE_USER_HOME = "C:\g"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;$env:Path"

# Prefer arm64-only for OnePlus 12R (faster device builds)
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = "arm64-v8a"

cd C:\Users\jerom\Desktop\claude\Projects\mypens\mypens-mobile

# --- 1) Connect wireless ADB (ASK USER for IP:port — do not scan LAN) ---
& $adb disconnect
& $adb connect PHONE_IP_PORT
& $adb devices -l
# Expect: CPH2609 (or IP:port) device  — not "offline" / "unauthorized"

# --- 2) If Cursor/sandbox previously poisoned Gradle paths, clean cxx + stop daemons ---
& $adb shell echo ok   # sanity: device still up
Get-Process -Name java -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -like "*Android*" -or $_.CommandLine -like "*gradle*"
} | Out-Null
if (Get-Command gradle -ErrorAction SilentlyContinue) { gradle --stop }
# Stop Gradle daemons via wrapper if present:
if (Test-Path .\android\gradlew.bat) {
  Push-Location android; .\gradlew.bat --stop; Pop-Location
}
Get-ChildItem -Path . -Recurse -Directory -Filter ".cxx" -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
# Especially: android\app\.cxx and node_modules\**\android\.cxx

# --- 3) Missing resources that blocked AAPT (create once if absent) ---
$ns = "android\app\src\main\res\xml\network_security_config.xml"
if (-not (Test-Path $ns)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $ns) | Out-Null
  @"
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.0.235</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
    <domain includeSubdomains="true">localhost</domain>
  </domain-config>
</network-security-config>
"@ | Set-Content -Encoding UTF8 $ns
}
Get-ChildItem "android\app\src\main\res" -Directory -Filter "mipmap-*" | ForEach-Object {
  $src = Join-Path $_.FullName "ic_launcher.webp"
  $dst = Join-Path $_.FullName "ic_launcher_round.webp"
  if ((Test-Path $src) -and -not (Test-Path $dst)) { Copy-Item $src $dst }
}

# --- 4) Debug install (NOT release) — Expo device name = model, NOT IP:port ---
npx expo run:android --device CPH2609 --no-bundler
# Equivalent Gradle: assembleDebug / installDebug under android\
# Do NOT pass --device 192.168.0.123:PORT — Expo rejects IP:port strings

# --- 5) After install: reverse ports + start packagers ---
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:5000 tcp:5000
# In separate terminals (if not already running):
#   npx expo start
#   (Next/API on :5000 as usual for this project)
```

### Quick re-attach (app already installed)

```powershell
$env:ANDROID_HOME = "C:\Users\jerom\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb connect PHONE_IP_PORT
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:5000 tcp:5000
& $adb shell monkey -p com.mypens.mobile -c android.intent.category.LAUNCHER 1
npx expo start
```

---

## Common failures → fix

| Symptom | Cause | Fix |
|--------|--------|-----|
| `adb` not found | platform-tools not on PATH | Use full path under `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`; set `ANDROID_HOME` / `ANDROID_SDK_ROOT` |
| `JAVA_HOME is not set` | Studio JBR not exported | `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` |
| `adb connect` fails / offline | Wrong or stale port | Ask user for **fresh** connect `IP:port` from Wireless debugging (not pairing port) |
| Expo: device / `--device` rejected | Passed `IP:port` | Use `--device CPH2609` (model name) |
| Shake / reload / dev menu dead | Release / non-debuggable APK | Rebuild with `expo run:android` / `assembleDebug` |
| ninja: **Filename longer than 260 characters** | Cursor sandbox `GRADLE_USER_HOME` under `...\Temp\cursor-sandbox-cache\...\gradle` | Force `GRADLE_USER_HOME=C:\g`; stop Gradle daemons; delete all `.cxx` dirs; rebuild. **Do not** use sandbox Gradle cache |
| AAPT: `network_security_config` missing | XML never created | Add `android/app/src/main/res/xml/network_security_config.xml` (cleartext for LAN API) |
| AAPT: `ic_launcher_round` missing | Round mipmaps absent | Copy `ic_launcher.webp` → `ic_launcher_round.webp` in each `mipmap-*` |
| Slow multi-ABI native build | Building all ABIs | `reactNativeArchitectures=arm64-v8a` (OnePlus 12R is arm64) |
| App can’t reach Metro / API | No reverse / servers down | `adb reverse tcp:8081` + `tcp:5000`; start Metro + Next |
| Metro crashes with ENOENT / exit 7 while cleaning | Deleted `node_modules/**/android/.cxx` while `expo start` was watching that path | **Stop Metro** before deleting `.cxx`; after Gradle/native build, restart `npx expo start --lan` |
| Agent wastes time scanning LAN | Guessing phone address | **Ask Jerome for IP:port**; last known IP often `192.168.0.123` but port always changes |

---

## Agent rules of thumb

1. **Ask** for wireless `IP:port` every session — never Nmap/ARP the LAN.
2. Always set **short** `GRADLE_USER_HOME=C:\g` before any Gradle/Expo Android build in Cursor.
3. Install **debug**, then `adb reverse`, then ensure Metro/Next are up.
4. Expo `--device` = **`CPH2609`**, ADB connect = **`IP:port`** — different identifiers for different tools.
5. Do not commit secrets, billing, or a full APK rebuild “just to check” unless a 30s `adb devices` shows the device and the install path is clearly broken.
)