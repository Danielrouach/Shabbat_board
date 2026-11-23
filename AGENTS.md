# AGENTS.md — לוח שבת / Shabbat Board

> **Start here for any AI agent or developer.** This file describes the *current deployed architecture* as of **2026-11-22**, not just the original prototype. Read this before editing. Keep it updated with structural or behavioral changes. The user communicates primarily in Hebrew; answer in Hebrew by default.

## 0. Read this in 60 seconds

- **Repository:** https://github.com/Danielrouach/Shabbat_board (default branch **main**).
- **Production main board:** https://shabbat.rouach.org/
- **Production elevator display:** https://elevator.rouach.org/ (redirects to https://shabbat.rouach.org/elevator/).
- **Private admin shortcut:** https://shabbat-admin.rouach.org/ (redirects to a separately deployed Google Apps Script app).
- **Stack:** static HTML/CSS/vanilla JavaScript on **GitHub Pages**; **Google Drive JSON** is the persistent schedule source; two distinct **Google Apps Script** web-app deployments bridge admin writes and public reads; **Hebcal** provides calendar, Shabbat, sunrise/sunset, and other halachic data.
- **There is no server-side GitHub JSON synchronization** and no framework, backend server, build pipeline or package manager in this repository. Pages only serves static files.
- **Critical:** changing apps-script-admin/Code.gs or apps-script-public/Code.gs *in GitHub does not redeploy Google Apps Script*. The owner must copy changes to the corresponding Apps Script project and deploy a **new version**. Browser code changes to main are published by GitHub Pages.
- **Security:** public Apps Script is **read-only**, invoked by browsers with JSONP. Private admin alone writes to Google Drive. Never add public write routes or secrets to static code; schedules exposed by the public endpoint are public information.
- **Current design principle:** a missing elevator schedule for the current week **reuses the most recent valid prior schedule** instead of showing a blank timetable. The update-warning text remains visible but **does not blink**.
- **Language and layout:** Hebrew, RTL, no-scroll kiosk on wide displays. Phones/tablets **in portrait** use a readable scrollable one-/two-column layout; **in landscape up to 1024px** they switch to a **three-column, no-scroll, content-aware scaled kiosk** (`responsive.css` + `fitLandscapeBoard()` in `index.html`). Automatic light/dark theme, 24h clock. Portrait phones use a single horizontal header row (parasha right, clock center, Gregorian date/location at the physical left edge); landscape uses a compact header. Narrow screens have a second, synchronized theme button and auto checkbox immediately below the header.

## 1. Architecture & trust boundaries

~~~text
Owner (browser)
  -> PRIVATE Admin Apps Script web app [execute as owner; access: only owner]
       -> Google Drive, ONE existing JSON file (read/modify/write)
  -> PUBLIC Read-only Apps Script web app [execute as owner; access: anyone]
       -> reads the same Drive JSON file
       -> returns JavaScript / JSONP callback (NOT a write API)
  -> public browser screens:
       shabbat.rouach.org/          main index.html
       shabbat.rouach.org/elevator/ elevator/index.html
       -> cloud-config.js provides public /exec endpoint URL
       -> cache returned weekly data in browser localStorage
       -> also fetch public Hebcal information when online
GitHub Pages serves only the static HTML/JS/CSS and assets.
Cloudflare handles DNS and redirect aliases; this setup is OUTSIDE this repo.
~~~

The public reader uses a generated **shabbatCloudCallback_...** callback name and a cache-busting query parameter. It accepts validated read requests only and runs with the owner's identity; public viewers do **not** receive Google Drive permission or an OAuth token.

**Production configuration lives in two places:** (1) the Git repository for the static site; (2) the *live* Apps Script projects / Drive document outside GitHub. The Apps Script code under Git is the source copy, not evidence of which version was last deployed. Likewise Cloudflare rules and Apps Script deployment IDs are external.

## 2. File map (verified current repository)

| File | Role / edit when... |
|---|---|
| **index.html** | Main Hebrew clock / Shabbat board, prayers, birthdays, Hebcal rendering, developer QA, wake lock, fullscreen; also cloud read and footer update statuses. Contains the portrait header fallback CSS, the additional `#mobile-theme-controls` markup directly after `</header>`, and conditional right-panel weekday section headings. |
| **lg-legacy.js** | ES5-only read-only fallback for old LG webOS 3 browsers lacking modern JavaScript parsing; uses XHR/JSONP and local cache for Haifa Hebcal, Shabbat times and prayer/elevator entries. Its time calculations/display are separate from modern modules, and some advanced halacha/birthday features may not have full parity. Loaded conditionally only on LG TV engines that fail optional-chaining feature detection; do not edit modern desktop/mobile paths to fix LG. |
| **responsive.css** | Responsive main-board overrides loaded after the main kiosk CSS (but before the final inline narrow-header fallback). Portrait: two columns on tablets (up to 1024px), one on phones (up to 768px), scrolling. Landscape up to 1024px: three columns, compact header/footer and no scrolling via CSS scale variables set by `fitLandscapeBoard()`. Also narrow-screen theme controls and readable right-panel section headings. |
| **elevator/index.html** | Canonical separate elevator screen at /elevator/; its own UI and cloud refresh, shared modules; display and preview of all elevator time windows. |
| **elevator.html** | Legacy direct URL to the elevator screen. Maintain behavior in BOTH elevator HTML files for any relevant screen change. |
| **shabbat-elevator.js** | Shared time-zone-aware logic: Israel local time, Hebcal havdalah/parasha caching, elevator time windows including Saturday evening continuation, cutoff. |
| **update-status.js** | Shared per-feature last-update parasha and timestamp status, warnings, and most-recent-prior-elevator-timetable lookup. |
| **theme.js** | Sunrise/sunset-based theme, manual override and checkbox, synchronization of *all* main-board theme buttons/checkboxes via `[data-theme-toggle]` / `[data-theme-auto]`, and storage synchronization between the two displays. |
| **cloud-config.js** | **Public read-only** Apps Script /exec URL. Not an API secret and not a write endpoint. |
| **apps-script-admin/Code.gs** | **Private write service**: savePrayerTimes and saveElevatorNotice. Copies new timestamps per feature and merges existing JSON. |
| **apps-script-admin/Admin.html** | Private HTML UI for admin, pasted elevator messages, prayer entry, OCR-assisted manual review; not on the public Pages UI. |
| **apps-script-public/Code.gs** | **Public read-only** doGet JSONP service reading the Drive file. |
| **CNAME** | Custom GitHub Pages domain: shabbat.rouach.org. |
| **.nojekyll** | Disable Jekyll processing on Pages. |
| **README.md** | Current human-friendly Hebrew overview, screens, architecture, operating instructions and the short deployment history. **This AGENTS.md remains the detailed agent/developer handoff.** |

Use focused changes; do not reformat or regenerate the entire ~1 MB main HTML. Avoid accidentally deleting embedded base64 images. No package install or build step is necessary.

## 3. Weekly JSON contract (do not break it)

The single Drive file is an object like:

~~~json
{
  "format": "halachic-weekly-v1",
  "updatedAt": "2026-11-22T12:27:00.000Z",
  "weeks": {
    "2026-11-22": {
      "weekdayMincha": "16:20",
      "weekdayArvit": "17:00",
      "fridayMinchaGedola": "12:30",
      "fridayCandles": "16:15",
      "fridayMinchaArvit": "+15",
      "shabbatMinchaGedola": "12:30",
      "shabbatMinchaKetana": "16:00",
      "shabbatArvit": "17:35",
      "prayersUpdatedAt": "2026-11-22T12:20:00.000Z",
      "elevatorFriday": [
        {"start":"18:00","end":"19:00"},
        {"start":"20:00","end":"21:00"}
      ],
      "elevatorSaturday": [
        {"start":"08:00","end":"09:00"}
      ],
      "elevatorUpdatedAt": "2026-11-22T12:27:00.000Z"
    }
  }
}
~~~

**Example only:** these are fictitious hours, not actual halachic or elevator times; never publish them as real schedules.

- Key for each week = **Gregorian Sunday date**, in YYYY-MM-DD. The admin accepts a date within that Sunday–Saturday week, normalizes to Sunday, and merges the entry. This storage key convention is distinct from the *displayed* parasha rollover.
- Prayer time fields are optional; "fridayMinchaArvit" can be a clock time or a **+N** minute offset relative to candle lighting.
- Elevator windows are arrays of HH:MM start/end pairs, Friday and Saturday separately. The private parser expects the first **two** detected intervals to be Friday and the remaining intervals Saturday (currently 3–40 total). It validates start < end and 24-hour values.
- Always **merge** with the same week's existing entry and preserve all other weeks: saving elevators must not erase prayers, and vice versa. Private writers use LockService when updating the single Drive file.
- **prayersUpdatedAt** and **elevatorUpdatedAt** are separate ISO timestamps written at successful save. **updatedAt** on the root is an overall timestamp; NEVER use it as proof that both features were updated. Legacy records may have no per-feature timestamp—do not invent one.
- Cloud reader wraps the above as callback({ok:true,data:...}) and does NOT directly expose a raw static JSON file on GitHub.

## 4. Refresh, caching, data persistence

| Action | Main board | Separate elevator |
|---|---|---|
| Cloud schedule fetch | DOMContentLoaded; every **15 minutes while visible** | At load; every **5 minutes**; also on visibility return |
| Visual clock | Every second | Every second |
| Hebcal / calendrical data | Main fetch at load and every **30 min**; other intervals vary | Elevator Shabbat/havdalah/parasha prefetch; hourly retry/prime |
| Offline data | localStorage key **halachic_kiosk_weekly_v1** | Same key, same origin when routed to /elevator/ |

Each screen stores a merged weekly DB in localStorage. This is a **cache**, not the authority. The browser can show previously retrieved data if the network becomes unavailable; first-time offline use may not have any cache. Cloud/Drive changes do not require a git commit or browser F5; the next successful sync picks them up.

**Elevator fallback invariant:** update-status.js / **elevatorSchedule(weeks,selectedWeek)** finds the most recent **valid** elevator timetable from a week at or before the selected week; prayer-only records must not hide a previous elevator schedule. This fallback is used by the separate elevator display AND the main board's next-three-windows widget. The fallback **must never pretend** that a fresh save occurred; last-update status remains based on the original saved timestamp. A future scheduled entry should not be displayed early.

**Parasha update status:** update-status.js / **status(weeks,feature,now)** computes the parasha of the actual last save for each feature independently, compares with the current parasha, and displays e.g.:
- Updated: "עודכן בפרשת נח (עדכון אחרון: ...)"
- Missing new update: "⚠ שים לב, לא עודכן עבור פרשת וירא (עדכון אחרון: ... · פרשת נח)"
- Displays in bottom-left footer of main board (two separate lines for Sh'erit Israel prayers and elevator), and in the elevator status line instead of "נתוני הענן נבדקו". **No flashing animation.**
- The status rollover is intended at **actual havdalah**, using cached Hebcal times where available; if havdalah/parasha is not available offline, handle uncertainty and don't invent an exact transition.
- Important: a week with unchanged elevator hours is a valid operational case: **retain the last real timetable**, while keeping the informational stale-update warning.

## 5. Halachic / display behaviors to protect

- Hebcal is queried with **Haifa** location identifier **294801** and time zone **Asia/Jerusalem** (not the viewer's arbitrary device time zone for shared calculations). Times must not silently be changed to a different city.
- shabbat-elevator.js computes Friday/Saturday active windows and repeats Friday night elevator windows on **Saturday evening**, capped at **havdalah + 30 minutes**. If havdalah is unavailable, do not claim a verified cutoff; retain appropriate warning.
- Main page includes fixed shacharit schedules, other calendrical widgets, birthdays, and Sh'erit Israel variable prayer times. Do not treat the fixed shacharit entries as cloud-edited.
- **Right-panel weekday section headings:** `#prayer-times-heading` (״זמני תפילות״) and `#shabbat-times-heading` (״זמני השבת״) are `.panel-title.weekday-section-title` siblings in `#right`, matching the other two panels' heading treatment. `updatePrayerOrder(now,data)` shows them only on ordinary Sunday–Thursday or Friday **before candle lighting**, and hides them on Shabbat and Yom Tov; the prayers title is also hidden if no prayer rows exist. The Shabbat title sits in the DOM **immediately before `#row-candles`**. The `weekday-prayers-first` flex orders keep the optional elevator widget first, then the prayers heading, prayer rows, Shabbat heading, and candle/havdalah rows. Preserve the current schedule values, Friday candle-time detection and weekend rendering. Right-column desktop auto-fit scales both headings using `--schedule-scale`; `responsive.css` gives them readable fixed sizing on scrollable screens.
- Main board has a small widget for the **next three elevator activity windows**; elevator page displays the full daily schedule / preview. Preserve the distinction.
- The public kiosk **must not expose editable prayer/elevator management controls**. Admin operates on its private Apps Script URL. User previously removed the settings button "ניהול זמני בית הכנסת ומעלית השבת"; do not reintroduce it.
- **Viewport fitting:** wide-screen desktop kiosk fits without scrolling; phones/tablets **in portrait** scroll to preserve readability. In **landscape at width <=1024px**, `#app` uses three columns, fixed positioning and a `transform:scale()` with logical width/height from `--landscape-board-*` variables. `fitLandscapeBoard()` binary-searches the largest scale fitting the visible viewport, measuring `scrollHeight`/`scrollWidth` and panel child bounds so it does not silently clip prayer, elevator, halacha or Shabbat rows. `requestColumnFit()` and `requestRightFit()` route landscape updates to this fitter; header, birthday banner, footer and panels are observed for resizes; orientation/fullscreen/visualViewport changes also refit. The original desktop font-fit runs above 1024px only. CSS lives in `responsive.css` (loaded after kiosk rules); the final inline narrow-header fallback in `index.html` is **portrait-only**. On exceptionally small landscape phones, text becomes smaller to keep every row visible. Test controls and accessibility on iPad Safari.
- **Theme behavior (`theme.js`):** the auto checkbox is checked by default; daylight between Hebcal sunrise and sunset = light, night = dark. With auto **on**, manual switching applies immediately and overrides the solar choice until page reload (F5); with auto **off**, the selected theme persists across reloads. Both main-board control pairs and the separate elevator screen share the applicable localStorage preference when served from the same origin. Preserve the temporary-override-versus-persistent-choice distinction.
- **Main-board theme controls:** the original footer button (`#theme-toggle`) and checkbox (`[data-theme-auto]`) remain. A compact additional pair (`#mobile-theme-toggle`, `#mobile-theme-auto`) lives inside `#mobile-theme-controls` directly after `#header` and before the prayer panels. The extra bar is **visible at width <=768px**, and in **landscape at any width 769–1024px**; otherwise it is hidden. In landscape <=1024px the redundant footer theme button/checkbox are hidden (the header pair remains usable), but all four controls remain synchronized. Both pairs use `[data-theme-toggle]` and `[data-theme-auto]`, which `theme.js` binds and refreshes with `querySelectorAll`; **never give them separate state or duplicate click logic**. The toggle label names the *destination* theme.
- **Narrow header layout:** portrait width <=768px uses a single compact grid row `"parasha clock location"` (RTL: parasha on physical right, clock centered, Gregorian day/date/Haifa on physical left). Keep the location column's `align-items: flex-end` and `text-align: left`: in RTL flex-start is the physical **right**, which caused the earlier misalignment. For landscape <=1024px, `responsive.css` uses a compact three-area header; short landscape 1025–1100px also has a compact header. The final inline CSS in `index.html` deliberately overrides the earlier phone-header CSS **only in portrait**; review both CSS sources and their cascade before editing. Bump the `responsive.css?v=...` cache key when changing the external stylesheet.
- Wake Lock requests start enabled by default on both screens, can be denied by OS/browser, and retry under supported conditions. This **cannot** bypass OS screen lock, battery restrictions or forced updates. Fullscreen API may be unavailable in iOS Safari; home-screen standalone mode may be needed.
- QA/developer mode: **Ctrl+Shift+Q** (main and elevator), or **?qa=1**; main also supports settings-button double-click. Date/time simulation must keep the visible clock, selected date, theme and highlighted current times consistent. Main supports preset-day dropdown and date/time override; resets back to actual time.
- Status warnings are **static (non-blinking)** by user request.

## 6. Recommended editing workflow for the next agent

1. **Read AGENTS.md and the exact source file(s)** from the current **main** branch; do not rely on memory alone. For a browser change, inspect index.html, elevator/index.html, elevator.html plus the relevant shared .js first.
2. State briefly in **Hebrew** what you will change, then make **focused** changes with GitHub's file edit operations. If the user requests edits, perform them in the repo rather than merely explaining how.
3. For an elevator UI change, patch **both** elevator/index.html and legacy elevator.html consistently. Put truly shared logic in shabbat-elevator.js or update-status.js where practical.
4. If altering the Drive schema/writers, change **apps-script-admin/Code.gs**, review public reader and both consumers, keep read-only public surface, preserve old data and backward compatibility. Explicitly tell the owner they must copy/redeploy Apps Script separately.
5. Never invent schedule times or enable writes from publicly readable code. Validate malformed JSON, absent weeks, network errors, and storage failures. Treat the public endpoint response as untrusted data for DOM rendering (prefer textContent, not unescaped HTML).
6. Verify targeted strings/logic in the committed files after each change and provide the changed-file/commit links. If browser/device testing wasn't performed, say so. No need to publish a special build or edit the Drive file for static-only changes.
7. Keep this document current if architecture, files, URLs, refresh cycles, schema or core invariants change.

## 7. Smoke tests / regression checklist

- **Admin saves prayers only:** prayers timestamp changes; elevator timestamp and its saved Friday/Saturday ranges stay unchanged.
- **Admin saves elevator only:** elevator timestamp changes; prayers remain unchanged. Verify both displays pick up the change on refresh.
- **Week rollover without elevator update:** elevator page displays the **last valid saved schedule**, including weekday preview and Shabbat activity windows; no "please save in admin" message if there is cached older schedule; informational parasha warning remains **static**.
- **Week rollover without prayer update:** main board warns; does not confuse a newer elevator update with a prayer update.
- **Parasha text:** "לא עודכן עבור פרשת X", not "לא עודכן מפרשת X"; last update date and former parasha are accurate if stored/cached.
- **Offline:** after one successful load, schedules persist; havdalah cutoff uncertainty clearly indicated if Hebcal cutoff wasn't cached.
- **Both themes:** check default auto on, manual-to-F5 behavior when on, persistent manual when off, and cross-screen coordination. Verify that clicking **either** main-board theme button changes the appearance immediately and updates **both** button labels/ARIA state; changing **either** checkbox updates both checkbox states and persists the auto preference. Test solar-time updates while a manual override is active, and reload with auto on/off.
- **Mobile theme bar:** verify `#mobile-theme-controls` appears **between header and panels** at portrait 320/360/390/430/768px and landscape <=1024px, is absent in ordinary desktop layouts, wraps cleanly, and keeps theme toggles/auto checkboxes synchronized. In landscape the duplicated footer theme controls are hidden to save height; the other footer controls must remain usable. The separate elevator display must remain unchanged.
- **Header RTL regression:** in portrait <=768px, keep parasha/date, clock and Gregorian day/date/location in one horizontal row; location text must align to the **physical left edge** of its grid cell, not its right edge. On short landscape (height <=600px, width <=1100px), verify the clock does not dominate the height or clip text. Check both dark and light themes.
- **Right-panel headings:** on ordinary Sunday–Thursday and Friday **before** candle lighting, show ״זמני תפילות״ directly above prayer entries and ״זמני השבת״ directly above `#row-candles`, with the same visual treatment as the other panel titles. Verify the optional Friday elevator widget remains above prayers, both headings disappear on Shabbat / Yom Tov / Friday after candle lighting, and the prayer heading disappears when no prayer entries exist. Test Sun, Fri before/after candles, Shabbat and narrow/desktop layouts, including QA simulation and viewport-fit. Do not change times or hide any schedule rows.
- **QA:** Ctrl+Shift+Q, select day preset, date/time pickers, start and reset; on-screen time must reflect the simulated instant with no mismatch.
- **Device layout:** desktop and **landscape phones/tablets <=1024px** must have no page scroll and no clipped content. Test at 568×320, 667×375, 844×390, 1024×768, plus landscape Friday with three elevator windows, Saturday and holidays; check header, all three panels, prayer/Shabbat headings, footer and copyright are visible, and rotate back to portrait to confirm scrolling returns. Test portrait at 320/360/390/430/768px for readability and no horizontal overflow. iPad Safari controls remain usable. Landscape fitting intentionally trades text size for full visibility; never solve overflow by hiding schedule rows. Inspect the portrait-only inline mobile-header fallback after `responsive.css` when investigating CSS precedence.
- **Safety:** no public write endpoint, no private admin buttons in public settings, no secrets committed, and no claim that Wake Lock is guaranteed.

## 8. External deployment / operations quick reference

- **Static release:** commit to **main** -> GitHub Pages (root) -> https://shabbat.rouach.org/. GitHub Pages custom domain is in **CNAME**.
- **Private write service:** separately deploy **apps-script-admin/Code.gs + Admin.html** as Web App, **Execute as me / Only myself**; share no write API publicly. Owner uses private shortcut domain.
- **Public read service:** separately deploy **apps-script-public/Code.gs** as Web App, **Execute as me / Anyone**; paste its public /exec URL into **cloud-config.js** *only if the endpoint changes*.
- **Drive source:** one existing JSON file referenced by both Apps Script projects' DATA_FILE_ID; an admin save rewrites the existing file's merged content.
- **DNS/redirects:** Cloudflare currently routes elevator.rouach.org to shabbat.rouach.org/elevator/ and shabbat-admin.rouach.org to the private Apps Script admin. These rules are NOT defined by the repo's CNAME and cannot be deployed by a Git commit alone.
- **Before Shabbat:** load both screens with internet, verify intended week's prayer and elevator data, verify havdalah cache, display fits and screen-sleep configuration. Browser wake-lock does not replace kiosk OS configuration.

## 9. Do not accidentally "fix" these intentional choices

- Missing this week's elevator entry is **not an instruction to hide the timetable**—use the last saved valid one.
- Last-update metadata is by **separate feature**, not global JSON updatedAt or time of last cloud fetch.
- "Updated in Parasha X" refers to the **save instant**, not necessarily the week-key assigned in the admin form.
- Public JSONP/Apps Script is deliberately **read-only**; don't move admin writes into the public endpoint.
- Both canonical and legacy elevator HTML files exist; don't leave them divergent.
- Static warning text must **not blink**.
- Never assume GitHub is actively fetching or storing Drive JSON, or that a Git commit automatically redeploys Apps Script.

---

**Pointers:** See README.md for the current human-friendly overview and the brief original deployment story. Source code is authoritative for implementation details. If anything conflicts, inspect the latest code and update both docs accordingly.

## Android blank-screen recovery

For Android Chrome phones <=768px in portrait, the early inline head script adds `android-board-recovery` to `html`. The final rules in `responsive.css` force a safe, normal-flow vertical flex layout without whole-app transforms, fixed positioning, clipping or GPU compositing. The burn-in pixel-shift transform is disabled for those devices. This is intentionally a temporary **scrollable** safety fallback after a Galaxy screenshot showed an entirely blank board; do not claim the universal no-scroll requirement is met on Android. The fetch error handler also dismisses the loading overlay. Keep the cache-busting CSS query current and validate on an actual Galaxy before attempting another compact layout.

## Android compact kiosk (CSS zoom)

Android <=1024px is routed to `fitAndroidBoard()` ahead of the legacy landscape fitter. The layout uses CSS `zoom` on `#app`, **not** `transform: scale`, because whole-app compositing caused a blank Galaxy screen. In narrow portrait <=599px, left and right schedules sit side-by-side and halacha cards form a three-column strip above; in wider/landscape, three panels share a row. All main board content remains present, and the fit is retriggered by existing resize/observer/data hooks. The old Android scroll-only safety fallback has been replaced. Test real Galaxy Chrome in portrait and landscape before declaring production rendering verified; do not reintroduce whole-app transforms.

- **Phone panel order:** On Android phones in portrait <=599px and landscape <=900px/height <=500px, show `left` and `right` schedule panels above the `center` halacha strip, followed by footer. Use grid areas `left right` then `center center`, with schedules receiving the flexible row and halacha an auto-sized row. Keep Android CSS zoom and anti-blank transform protection intact.

## LG UH617Y / legacy webOS 3 compatibility (2026-11-23)

- The first small inline script in `index.html` identifies LG TV webOS user agents and adds `lg-tv-board` before CSS. The second script after `cloud-config.js` detects unavailable optional chaining and uses `document.write` to load `lg-legacy.js` synchronously before the modern scripts. Modern JS syntax errors on old TV engines do not prevent the separate ES5 runtime from running.
- `lg-legacy.js` is deliberately ES5 syntax (no `let`, `const`, arrow, `async`, destructuring, template strings, optional chaining); it uses XMLHttpRequest for the same public Hebcal APIs and JSONP for the same public read-only cloud endpoint. It never writes schedule data to the cloud. Last successful responses are cached locally for the same Gregorian day.
- `responsive.css` contains LG-only flexbox layout rules in `html.lg-tv-board` and readable content sizing for `html.lg-tv-board.lg-legacy-runtime`. Never apply those styles to Android/mobile/desktop. The CSS URL is cache-busted in index.html.
- Legacy mode does NOT guarantee parity with all modern dashboard features: some halachic cards, birthdays and advanced settings need future verification on the actual device. Do not invent missing halachic values or elevator cutoff times. If older TV browsers reject CORS/TLS for Hebcal, they can show cached content only after a successful request.
- Follow-up test on the actual LG UH617Y firmware 05.70.50: verify seconds advance, Hebrew date and parasha, zmanim, prayer/elevator JSONP, day-night theme, regular and Shabbat mode, and no scrolling. Existing modern clients should be smoke tested separately; this TV was not remotely emulated.

## Legacy LG webOS 3 follow-up (2026-11-23, second pass)

- The main TV layout is RTL flex now: **zmanim on the physical right**, halacha center and prayer/Shabbat on the left, matching the normal dashboard. This is limited to `html.lg-tv-board` in responsive.css, not modern layouts.
- `lg-legacy.js` now initializes the fullscreen button using supported browser API prefixes, and explicitly explains that Screen Wake Lock is **not available** in this old LG webOS browser. No website can force webOS not to sleep. The two footer update indicators use the latest recorded `prayersUpdatedAt` and `elevatorUpdatedAt`; missing timestamps are shown as missing rather than guessed.
- The legacy halacha display hides unverified cards; Tachanun is only shown after the public holiday/calendar feed succeeds. Holiday, Rosh Chodesh and Omer cards do not display uncomputed placeholder values.
- The elevator screen and the legacy elevator.html URL now have an independent `lg-elevator-legacy.js` ES5 entrypoint loaded only on legacy LG browsers. It renders schedule preview on weekdays, active Friday/Shabbat intervals, last recorded elevator timestamp, date and clock, data caching and a read-only cloud sync. The two files have the correct relative URL to the same script. The normal elevator JS and HTML remain unchanged for modern clients.
- On the legacy elevator, Saturday-evening repetition of Friday intervals is displayed **only when a verified Havdalah cutoff is available**, otherwise it is omitted with a warning. Do not invent cutoff times. Test preview/Friday/Saturday and no-connection caching on the real LG; legacy mode is not equivalent to the full modern display.
- Both legacy scripts were syntax checked for ES5-only constructs. **No physical LG test or end-to-end browser test was performed**; verify on UH617Y firmware 05.70.50 and modern clients before claiming complete parity.
