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
- **Language and layout:** Hebrew, RTL, no-scroll kiosk on wide displays; readable scrollable one-/two-column layout on phones/tablets (responsive.css), automatic light/dark theme, 24h clock.

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
| **index.html** | Main Hebrew clock / Shabbat board, prayers, birthdays, Hebcal rendering, developer QA, wake lock, fullscreen; also cloud read and footer update statuses. |
| **responsive.css** | Responsive main-board overrides loaded after index.html's inline kiosk CSS. Two columns on tablets (up to 1024px), one column and stacked header on phones (up to 768px), touch-friendly controls and scrolling on narrow screens. |
| **elevator/index.html** | Canonical separate elevator screen at /elevator/; its own UI and cloud refresh, shared modules; display and preview of all elevator time windows. |
| **elevator.html** | Legacy direct URL to the elevator screen. Maintain behavior in BOTH elevator HTML files for any relevant screen change. |
| **shabbat-elevator.js** | Shared time-zone-aware logic: Israel local time, Hebcal havdalah/parasha caching, elevator time windows including Saturday evening continuation, cutoff. |
| **update-status.js** | Shared per-feature last-update parasha and timestamp status, warnings, and most-recent-prior-elevator-timetable lookup. |
| **theme.js** | Sunrise/sunset-based theme, manual override and checkbox, storage synchronization between the two displays. |
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
- Main board has a small widget for the **next three elevator activity windows**; elevator page displays the full daily schedule / preview. Preserve the distinction.
- The public kiosk **must not expose editable prayer/elevator management controls**. Admin operates on its private Apps Script URL. User previously removed the settings button "ניהול זמני בית הכנסת ומעלית השבת"; do not reintroduce it.
- Wide-screen kiosk mode fits without scrolling; the main board intentionally scrolls at widths up to 1024px to avoid clipping on tablets and phones. It loads responsive.css after its inline kiosk rules; the auto-fit JavaScript runs only above 1024px. Test that settings/footer controls remain accessible, including in iPad Safari.
- **theme.js:** automatic theme checkbox is checked by default; daylight between Hebcal sunrise and sunset = light, night = dark. When auto is on, a manual theme change holds until F5; with auto off, manual choice persists. Screens share localStorage preference when served under the main origin.
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
- **Both themes:** check default auto on, manual-to-F5 behavior when on, persistent manual when off, cross-screen coordination.
- **QA:** Ctrl+Shift+Q, select day preset, date/time pickers, start and reset; on-screen time must reflect the simulated instant with no mismatch.
- **Device layout:** desktop kiosk has no unwanted scrolling; at 1024px/768px/430px and narrow phones, panels and footer remain readable via page scrolling, with no horizontal overflow. iPad Safari buttons remain usable; all Friday/Saturday elevator intervals fit.
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
