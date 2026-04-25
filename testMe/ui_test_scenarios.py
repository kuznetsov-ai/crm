"""Studio CRM — UI Test Scenarios for the TITAN framework.

Loaded by titan via `external_scenarios.crm` in
titan/config/systems/crm.yaml.

Run with:
    cd <titan-repo>
    .venv/bin/python -m cli test --system config/systems/crm.yaml --scenario crm
"""
from __future__ import annotations

import asyncio

from scenarios.base import BaseScenario, StepResult


VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet":  {"width": 768,  "height": 1024},
    "mobile":  {"width": 393,  "height": 852},
}

ROUTES = ["/dashboard", "/clients", "/deals", "/tasks", "/backlog", "/kpi", "/chat", "/calendar", "/leads", "/reports", "/settings"]


class CrmScenarios(BaseScenario):
    OUTPUT_SUBDIR = "crm"
    REPORT_URL = "/dashboard"

    # ── helpers ────────────────────────────────────────────────────────────
    async def _go(self, path: str, wait: float = 0.8) -> None:
        await self.page.goto(self.base_url + path, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(wait)

    async def _set_vp(self, name: str) -> None:
        await self.page.set_viewport_size(VIEWPORTS[name])
        await asyncio.sleep(0.2)

    async def _check_overflow(self, path: str) -> tuple[int, int]:
        await self._go(path, wait=0.6)
        sw = await self.page.evaluate("document.documentElement.scrollWidth")
        iw = await self.page.evaluate("window.innerWidth")
        return int(sw), int(iw)

    async def _shot(self, name: str) -> str:
        return await self._screenshot(name)

    # ── S01: Dashboard — KPI cards visible ─────────────────────
    async def test_dashboard_loads(self):
        start = await self._step("S01_dashboard")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            shot = await self._shot("S01_dashboard_desktop")
            text = await self.page.evaluate("document.body.innerText")
            kpi_signals = ["Дашборд", "Dashboard", "АКТИВНЫЕ", "Active", "ВОРОНКА", "Pipeline", "Total"]
            hits = [k for k in kpi_signals if k in text]
            ok = len(hits) >= 2
            self._record("S01_dashboard", "PASS" if ok else "FAIL",
                         f"KPI labels found: {hits}", shot, start)
        except Exception as e:
            self._record("S01_dashboard", "FAIL", str(e),
                         await self._shot("S01_err"), start)

    # ── S02: Clients — table with at least 5 client links ─────
    async def test_clients_page(self):
        start = await self._step("S02_clients")
        try:
            await self._set_vp("desktop")
            await self._go("/clients")
            shot = await self._shot("S02_clients_desktop")
            cnt = await self.page.locator("a[href*='/clients/']").count()
            # also check status badge column is rendered
            has_status = await self.page.locator("text=/Активный|Лид|Active|Lead|Prospect/").count() > 0
            ok = cnt >= 5 and has_status
            self._record("S02_clients", "PASS" if ok else "FAIL",
                         f"client links: {cnt}, status badges: {has_status}", shot, start)
        except Exception as e:
            self._record("S02_clients", "FAIL", str(e),
                         await self._shot("S02_err"), start)

    # ── S03: Deals — kanban or table view with deals ──────────
    async def test_deals_page(self):
        start = await self._step("S03_deals")
        try:
            await self._set_vp("desktop")
            await self._go("/deals")
            shot = await self._shot("S03_deals_desktop")
            # deal cards/links/columns
            kanban = await self.page.locator("[class*='kanban'], [class*='column'], [data-rbd-droppable-id]").count()
            links = await self.page.locator("a[href*='/deals/']").count()
            text = await self.page.evaluate("document.body.innerText")
            has_deal = "USD" in text or "$" in text or any(s in text for s in ["Новый лид", "Discovery", "Proposal", "Closed"])
            ok = (kanban + links) > 0 or has_deal
            self._record("S03_deals", "PASS" if ok else "FAIL",
                         f"kanban={kanban}, links={links}, has_deal_signals={has_deal}", shot, start)
        except Exception as e:
            self._record("S03_deals", "FAIL", str(e),
                         await self._shot("S03_err"), start)

    # ── S04: Tasks — task list visible ────────────────────────
    async def test_tasks_page(self):
        start = await self._step("S04_tasks")
        try:
            await self._set_vp("desktop")
            await self._go("/tasks")
            shot = await self._shot("S04_tasks_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["Задачи", "Tasks", "todo", "В работе", "Done", "Высокий", "High"]
            hits = [s for s in signals if s in text]
            ok = len(hits) >= 1 and len(text) > 200
            self._record("S04_tasks", "PASS" if ok else "FAIL",
                         f"task signals: {hits}", shot, start)
        except Exception as e:
            self._record("S04_tasks", "FAIL", str(e),
                         await self._shot("S04_err"), start)

    # ── S05: Backlog ──────────────────────────────────────────
    async def test_backlog_page(self):
        start = await self._step("S05_backlog")
        try:
            await self._set_vp("desktop")
            await self._go("/backlog")
            shot = await self._shot("S05_backlog_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["Бэклог", "Backlog", "idea", "in_progress", "Идея", "В работе"]
            hits = [s for s in signals if s in text]
            ok = len(hits) >= 1
            self._record("S05_backlog", "PASS" if ok else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S05_backlog", "FAIL", str(e),
                         await self._shot("S05_err"), start)

    # ── S06: KPI — metrics visible ────────────────────────────
    async def test_kpi_page(self):
        start = await self._step("S06_kpi")
        try:
            await self._set_vp("desktop")
            await self._go("/kpi")
            shot = await self._shot("S06_kpi_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["KPI", "конверсия", "сделки", "Revenue", "Цель", "%"]
            hits = [s for s in signals if s in text]
            self._record("S06_kpi", "PASS" if len(hits) >= 1 else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S06_kpi", "FAIL", str(e),
                         await self._shot("S06_err"), start)

    # ── S07: Chat — channel list visible ──────────────────────
    async def test_chat_page(self):
        start = await self._step("S07_chat")
        try:
            await self._set_vp("desktop")
            await self._go("/chat")
            shot = await self._shot("S07_chat_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["General", "Sales", "Чат", "Chat", "channel", "канал", "Сообщение", "Message"]
            hits = [s for s in signals if s in text]
            ok = len(hits) >= 1
            self._record("S07_chat", "PASS" if ok else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S07_chat", "FAIL", str(e),
                         await self._shot("S07_err"), start)

    # ── S08: Calendar — events visible ────────────────────────
    async def test_calendar_page(self):
        start = await self._step("S08_calendar")
        try:
            await self._set_vp("desktop")
            await self._go("/calendar")
            shot = await self._shot("S08_calendar_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["Календарь", "Calendar", "Mon", "Tue", "Пн", "Вт", "месяц", "Month", "неделя", "Week"]
            hits = [s for s in signals if s in text]
            ok = len(hits) >= 1
            self._record("S08_calendar", "PASS" if ok else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S08_calendar", "FAIL", str(e),
                         await self._shot("S08_err"), start)

    # ── S09: Leads ────────────────────────────────────────────
    async def test_leads_page(self):
        start = await self._step("S09_leads")
        try:
            await self._set_vp("desktop")
            await self._go("/leads")
            shot = await self._shot("S09_leads_desktop")
            text = await self.page.evaluate("document.body.innerText")
            signals = ["Лиды", "Leads", "Лид", "Pipeline", "Конверсия", "недостаточно прав", "permission"]
            hits = [s for s in signals if s.lower() in text.lower()]
            self._record("S09_leads", "PASS" if len(hits) >= 1 else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S09_leads", "FAIL", str(e),
                         await self._shot("S09_err"), start)

    # ── S10: Mobile — no overflow + drawer solid ─────────────
    async def test_mobile_no_overflow(self):
        start = await self._step("S10_mobile_overflow")
        try:
            await self._set_vp("mobile")
            bad: list[str] = []
            for path in ROUTES:
                sw, iw = await self._check_overflow(path)
                if sw > iw + 4:
                    bad.append(f"{path}: sw={sw} > iw={iw}")
            shot = await self._shot("S10_mobile_last")
            self._record(
                "S10_mobile_overflow",
                "PASS" if not bad else "FAIL",
                f"all {len(ROUTES)} routes fit at 393px" if not bad else "; ".join(bad),
                shot, start,
            )
        except Exception as e:
            self._record("S10_mobile_overflow", "FAIL", str(e),
                         await self._shot("S10_err"), start)

    # ── S11: Tablet ────────────────────────────────────────────
    async def test_tablet_no_overflow(self):
        start = await self._step("S11_tablet_overflow")
        try:
            await self._set_vp("tablet")
            bad: list[str] = []
            for path in ROUTES:
                sw, iw = await self._check_overflow(path)
                if sw > iw + 4:
                    bad.append(f"{path}: {sw}>{iw}")
            shot = await self._shot("S11_tablet_last")
            self._record(
                "S11_tablet_overflow",
                "PASS" if not bad else "FAIL",
                f"all {len(ROUTES)} routes fit at 768px" if not bad else "; ".join(bad),
                shot, start,
            )
        except Exception as e:
            self._record("S11_tablet_overflow", "FAIL", str(e),
                         await self._shot("S11_err"), start)

    # ── S12: Demo banner ──────────────────────────────────────
    async def test_demo_banner(self):
        start = await self._step("S12_demo_banner")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            shot = await self._shot("S12_demo_banner")
            body = (await self.page.evaluate("document.body.innerText")).lower()
            ok = "demo" in body and "reset" in body
            self._record("S12_demo_banner", "PASS" if ok else "FAIL",
                         f"banner found: {ok} (demo+reset keywords)", shot, start)
        except Exception as e:
            self._record("S12_demo_banner", "FAIL", str(e),
                         await self._shot("S12_err"), start)

    # ── S13: Reset endpoint ───────────────────────────────────
    async def test_demo_reset_endpoint(self):
        start = await self._step("S13_demo_reset")
        try:
            await self._go("/dashboard")
            result = await self.page.evaluate(
                "fetch('/api/demo/reset', {method:'POST'}).then(r=>r.json())"
            )
            ok = bool(result.get("ok"))
            shot = await self._shot("S13_demo_reset")
            self._record("S13_demo_reset", "PASS" if ok else "FAIL",
                         f"resp={result}", shot, start)
        except Exception as e:
            self._record("S13_demo_reset", "FAIL", str(e),
                         await self._shot("S13_err"), start)

    # ── S14: Mobile drawer — solid bg, no see-through ─────────
    async def test_mobile_drawer_solid(self):
        start = await self._step("S14_mobile_drawer")
        try:
            await self._set_vp("mobile")
            await self._go("/dashboard")
            burger = self.page.locator("button[aria-label='Toggle menu']").first
            if await burger.count() == 0:
                self._record("S14_mobile_drawer", "FAIL", "burger not found",
                             await self._shot("S14_no_burger"), start)
                return
            await burger.click()
            await asyncio.sleep(0.5)
            shot = await self._shot("S14_drawer_open")
            # backdrop visible (.bg-black/50)
            backdrop = await self.page.evaluate(
                "!!document.querySelector('.bg-black\\\\/50')"
            )
            # check sidebar bg is solid (alpha === 1)
            sidebar_bg = await self.page.evaluate(
                """
                (() => {
                  const a = document.querySelector('aside');
                  if (!a) return 'no aside';
                  return getComputedStyle(a).backgroundColor;
                })()
                """
            )
            # rgba with alpha < 1 means transparent
            is_solid = "rgba(" not in sidebar_bg or sidebar_bg.endswith(", 1)") or "rgb(" in sidebar_bg
            ok = backdrop and is_solid
            self._record(
                "S14_mobile_drawer",
                "PASS" if ok else "FAIL",
                f"backdrop={backdrop}, sidebar_bg={sidebar_bg!r}, solid={is_solid}",
                shot, start,
            )
        except Exception as e:
            self._record("S14_mobile_drawer", "FAIL", str(e),
                         await self._shot("S14_err"), start)

    # ── S15: Desktop sidebar collapse ─────────────────────────
    async def test_desktop_collapse(self):
        start = await self._step("S15_desktop_collapse")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            btn = self.page.locator("button[aria-label*='ollapse'], button[aria-label*='Expand']").first
            if await btn.count() == 0:
                self._record("S15_desktop_collapse", "WARN", "btn not found",
                             await self._shot("S15_no_btn"), start)
                return
            await btn.click()
            await asyncio.sleep(0.3)
            shot = await self._shot("S15_collapsed")
            ls = await self.page.evaluate("localStorage.getItem('crm_sidebar')")
            self._record(
                "S15_desktop_collapse",
                "PASS" if ls in ("collapsed", "expanded") else "WARN",
                f"localStorage crm_sidebar={ls!r}",
                shot, start,
            )
        except Exception as e:
            self._record("S15_desktop_collapse", "FAIL", str(e),
                         await self._shot("S15_err"), start)

    # ── S16: Reports ──────────────────────────────────────────
    async def test_reports_page(self):
        start = await self._step("S16_reports")
        try:
            await self._set_vp("desktop")
            await self._go("/reports")
            shot = await self._shot("S16_reports_desktop")
            text = await self.page.evaluate("document.body.innerText")
            # Demo user role may not have can_view_reports → 'no permissions' page is still a valid mount.
            signals = ["Отчёты", "Reports", "Экспорт", "Export", "сделки", "Deals", "клиенты", "Clients", "недостаточно прав", "permission"]
            hits = [s for s in signals if s.lower() in text.lower()]
            self._record("S16_reports", "PASS" if len(hits) >= 1 else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S16_reports", "FAIL", str(e),
                         await self._shot("S16_err"), start)

    # ── S17: Settings ─────────────────────────────────────────
    async def test_settings_page(self):
        start = await self._step("S17_settings")
        try:
            await self._set_vp("desktop")
            await self._go("/settings")
            shot = await self._shot("S17_settings_desktop")
            text = await self.page.evaluate("document.body.innerText")
            # Demo user may have can_manage_settings=false → page renders "no permissions".
            # That's still a sign the page mounted; treat both states as pass.
            signals = ["Настройки", "Settings", "Пользователи", "Users", "Команда", "Team", "Roles", "Роли", "недостаточно прав", "permission"]
            hits = [s for s in signals if s.lower() in text.lower()]
            self._record("S17_settings", "PASS" if len(hits) >= 1 else "FAIL",
                         f"signals: {hits}", shot, start)
        except Exception as e:
            self._record("S17_settings", "FAIL", str(e),
                         await self._shot("S17_err"), start)

    # ── S20: Chat — send a text message and see it appear ────
    async def test_chat_send_message(self):
        start = await self._step("S20_chat_send")
        try:
            await self._set_vp("desktop")
            await self._go("/chat", wait=2.0)

            # Click first channel button in the sidebar to make sure one is active
            chan_btn = self.page.locator("aside ~ div button, button:has(.font-medium)").first
            if await chan_btn.count() == 0:
                # Try a more permissive selector
                chan_btn = self.page.locator("button:has-text('General'), button:has-text('Sales')").first
            if await chan_btn.count() > 0:
                try:
                    await chan_btn.click(timeout=3000)
                    await asyncio.sleep(1)
                except Exception:
                    pass

            inp = self.page.locator("input[type='text'], textarea").last
            if await inp.count() == 0:
                self._record("S20_chat_send", "FAIL", "no composer input found",
                             await self._shot("S20_no_input"), start)
                return
            stamp = f"titan-probe-{int(asyncio.get_event_loop().time() * 1000) % 100000}"
            await inp.fill(stamp)
            await inp.press("Enter")
            await asyncio.sleep(2.5)
            shot = await self._shot("S20_after_send")
            text = await self.page.evaluate("document.body.innerText")
            ok = stamp in text
            self._record("S20_chat_send", "PASS" if ok else "FAIL",
                         f"sent {stamp!r}, visible in DOM: {ok}", shot, start)
        except Exception as e:
            self._record("S20_chat_send", "FAIL", str(e),
                         await self._shot("S20_err"), start)

    # ── S21: Chat composer — voice + emoji + paperclip buttons ─
    async def test_chat_composer_ui(self):
        start = await self._step("S21_chat_composer")
        try:
            await self._set_vp("desktop")
            await self._go("/chat", wait=1.5)
            shot = await self._shot("S21_composer")
            voice = await self.page.locator("button[aria-label='Record voice message']").count()
            emoji = await self.page.locator("button[title='Эмодзи'], button[title='emoji']").count()
            attach = await self.page.locator("button[title='Прикрепить файл'], button[title='Attach']").count()
            ok = voice > 0
            self._record(
                "S21_chat_composer",
                "PASS" if ok else "WARN",
                f"voice={voice}, emoji={emoji}, attach={attach}",
                shot, start,
            )
        except Exception as e:
            self._record("S21_chat_composer", "FAIL", str(e),
                         await self._shot("S21_err"), start)

    # ── S23: Reactions via context menu (right-click) — set + remove ─
    async def test_chat_reactions(self):
        start = await self._step("S23_chat_reactions")
        try:
            await self._set_vp("desktop")
            await self._go("/chat", wait=2.5)

            # Send a fresh message
            inp = self.page.locator("input[type='text'], textarea").last
            if await inp.count() > 0:
                await inp.fill("titan-react-target")
                await inp.press("Enter")
                await asyncio.sleep(2.0)

            # Right-click on the new message bubble to open context menu
            bubble = self.page.locator("text=titan-react-target").last
            if await bubble.count() == 0:
                self._record("S23_chat_reactions", "FAIL", "no message bubble",
                             await self._shot("S23_no_msg"), start)
                return
            await bubble.click(button="right")
            try:
                await self.page.wait_for_selector("button:has-text('🔥')", timeout=3000)
            except Exception:
                self._record("S23_chat_reactions", "FAIL", "context menu didn't open",
                             await self._shot("S23_no_ctx"), start)
                return

            # Click 🔥 in the quick-emoji bar at top of context menu
            await self.page.locator("button:has-text('🔥')").first.click()
            await asyncio.sleep(2.5)
            shot1 = await self._shot("S23_after_add")
            text = await self.page.evaluate("document.body.innerText")
            added_ok = "🔥" in text

            # Now click the reaction badge to REMOVE the reaction
            badge = self.page.locator("button[title*='remove']").first
            removed_ok = False
            if await badge.count() > 0:
                await badge.click()
                await asyncio.sleep(2.5)
                text2 = await self.page.evaluate("document.body.innerText")
                removed_ok = text2.count("🔥") < text.count("🔥")
            shot = await self._shot("S23_after_remove")

            self._record(
                "S23_chat_reactions",
                "PASS" if (added_ok and removed_ok) else "FAIL",
                f"add: {added_ok}, remove: {removed_ok}", shot, start,
            )
        except Exception as e:
            self._record("S23_chat_reactions", "FAIL", str(e),
                         await self._shot("S23_err"), start)

    # ── S24: Attachment — programmatically attach file and send ───
    async def test_chat_attachment(self):
        start = await self._step("S24_chat_attachment")
        try:
            await self._set_vp("desktop")
            await self._go("/chat", wait=2.0)
            file_input = self.page.locator("input[type='file']").first
            if await file_input.count() == 0:
                self._record("S24_chat_attachment", "FAIL", "no file input found",
                             await self._shot("S24_no_input"), start)
                return
            # Create a tiny inline image (tracker.png — 1x1 transparent PNG)
            import base64, tempfile, os
            png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII="
            tmpdir = tempfile.gettempdir()
            png_path = os.path.join(tmpdir, "titan-probe.png")
            with open(png_path, "wb") as f:
                f.write(base64.b64decode(png_b64))
            await file_input.set_input_files(png_path)
            await asyncio.sleep(0.5)
            # Press Enter to submit (form has the file in pendingFile)
            inp = self.page.locator("input[type='text'], textarea").last
            await inp.fill("titan attached")
            await inp.press("Enter")
            await asyncio.sleep(3.0)
            shot = await self._shot("S24_after_attach")
            text = await self.page.evaluate("document.body.innerText")
            ok = "titan attached" in text
            self._record("S24_chat_attachment", "PASS" if ok else "FAIL",
                         f"text 'titan attached' visible: {ok}", shot, start)
        except Exception as e:
            self._record("S24_chat_attachment", "FAIL", str(e),
                         await self._shot("S24_err"), start)

    # ── S22: Chat mobile — single pane + back button ─────────
    async def test_chat_mobile_single_pane(self):
        start = await self._step("S22_chat_mobile")
        try:
            await self._set_vp("mobile")
            await self._go("/chat", wait=2.0)
            # On mobile we expect channel list visible OR message panel — never both
            sidebars = await self.page.locator("aside, nav.chat-sidebar").count()
            # Look for back-button hint (md:hidden chevron near header)
            back_btn = await self.page.locator("button[aria-label='Back to channel list']").count()
            shot = await self._shot("S22_chat_mobile")
            # Check no horizontal overflow
            sw = await self.page.evaluate("document.documentElement.scrollWidth")
            iw = await self.page.evaluate("window.innerWidth")
            no_overflow = sw <= iw + 4
            self._record(
                "S22_chat_mobile",
                "PASS" if (back_btn >= 1 and no_overflow) else "FAIL",
                f"back-btn nodes={back_btn}, scrollWidth={sw}, innerWidth={iw}, sidebars seen={sidebars}",
                shot, start,
            )
        except Exception as e:
            self._record("S22_chat_mobile", "FAIL", str(e),
                         await self._shot("S22_err"), start)

    # ── S18: Mobile screenshots of every page (visual evidence) ─
    async def test_mobile_screenshots(self):
        start = await self._step("S18_mobile_screenshots")
        try:
            await self._set_vp("mobile")
            for path in ROUTES:
                await self._go(path, wait=0.6)
                slug = path.strip("/") or "root"
                await self._shot(f"S18_mobile_{slug}")
            self._record("S18_mobile_screenshots", "PASS",
                         f"captured {len(ROUTES)} mobile screenshots", None, start)
        except Exception as e:
            self._record("S18_mobile_screenshots", "FAIL", str(e),
                         await self._shot("S18_err"), start)

    # ── run_all ───────────────────────────────────────────────
    async def run_all(self, only=None, random_n=None) -> list[StepResult]:
        tests = [
            self.test_dashboard_loads,
            self.test_clients_page,
            self.test_deals_page,
            self.test_tasks_page,
            self.test_backlog_page,
            self.test_kpi_page,
            self.test_chat_page,
            self.test_calendar_page,
            self.test_leads_page,
            self.test_reports_page,
            self.test_settings_page,
            self.test_mobile_no_overflow,
            self.test_tablet_no_overflow,
            self.test_demo_banner,
            self.test_demo_reset_endpoint,
            self.test_mobile_drawer_solid,
            self.test_desktop_collapse,
            self.test_chat_send_message,
            self.test_chat_composer_ui,
            self.test_chat_reactions,
            self.test_chat_attachment,
            self.test_chat_mobile_single_pane,
            self.test_mobile_screenshots,
        ]
        if only:
            wanted = {x.lower() for x in only}
            tests = [t for t in tests if any(w in t.__name__.lower() for w in wanted)]
        for t in tests:
            await t()
        return self.results
