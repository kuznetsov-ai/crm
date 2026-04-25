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

# Routes that should fit cleanly inside their viewport on every breakpoint.
ROUTES = ["/dashboard", "/clients", "/deals", "/tasks", "/backlog", "/kpi", "/chat", "/calendar"]


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

    # ── S01: Dashboard ──────────────────────────────────────────
    async def test_dashboard_loads(self):
        start = await self._step("S01_dashboard")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            shot = await self._screenshot("S01_dashboard")
            title = await self.page.title()
            ok = "Studio CRM" in title or "CRM" in title
            self._record("S01_dashboard", "PASS" if ok else "FAIL",
                         f"title={title!r}", shot, start)
        except Exception as e:
            self._record("S01_dashboard", "FAIL", str(e),
                         await self._screenshot("S01_err"), start)

    # ── S02: Clients page ──────────────────────────────────────
    async def test_clients_page(self):
        start = await self._step("S02_clients")
        try:
            await self._set_vp("desktop")
            await self._go("/clients")
            shot = await self._screenshot("S02_clients")
            cnt = await self.page.locator("a[href*='/clients/']").count()
            self._record("S02_clients", "PASS" if cnt > 0 else "FAIL",
                         f"client links: {cnt}", shot, start)
        except Exception as e:
            self._record("S02_clients", "FAIL", str(e),
                         await self._screenshot("S02_err"), start)

    # ── S03: Deals page ────────────────────────────────────────
    async def test_deals_page(self):
        start = await self._step("S03_deals")
        try:
            await self._set_vp("desktop")
            await self._go("/deals")
            shot = await self._screenshot("S03_deals")
            cnt = await self.page.locator("a[href*='/deals/'], [data-deal-id], [data-rbd-draggable-id]").count()
            self._record("S03_deals", "PASS" if cnt > 0 else "WARN",
                         f"deal nodes: {cnt}", shot, start)
        except Exception as e:
            self._record("S03_deals", "FAIL", str(e),
                         await self._screenshot("S03_err"), start)

    # ── S04: Tasks ─────────────────────────────────────────────
    async def test_tasks_page(self):
        start = await self._step("S04_tasks")
        try:
            await self._set_vp("desktop")
            await self._go("/tasks")
            shot = await self._screenshot("S04_tasks")
            text_len = len(await self.page.evaluate("document.body.innerText"))
            self._record("S04_tasks", "PASS" if text_len > 100 else "FAIL",
                         f"body chars: {text_len}", shot, start)
        except Exception as e:
            self._record("S04_tasks", "FAIL", str(e),
                         await self._screenshot("S04_err"), start)

    # ── S05: Backlog ───────────────────────────────────────────
    async def test_backlog_page(self):
        start = await self._step("S05_backlog")
        try:
            await self._set_vp("desktop")
            await self._go("/backlog")
            shot = await self._screenshot("S05_backlog")
            text_len = len(await self.page.evaluate("document.body.innerText"))
            self._record("S05_backlog", "PASS" if text_len > 100 else "FAIL",
                         f"body chars: {text_len}", shot, start)
        except Exception as e:
            self._record("S05_backlog", "FAIL", str(e),
                         await self._screenshot("S05_err"), start)

    # ── S06: KPI ───────────────────────────────────────────────
    async def test_kpi_page(self):
        start = await self._step("S06_kpi")
        try:
            await self._set_vp("desktop")
            await self._go("/kpi")
            shot = await self._screenshot("S06_kpi")
            text_len = len(await self.page.evaluate("document.body.innerText"))
            self._record("S06_kpi", "PASS" if text_len > 50 else "FAIL",
                         f"body chars: {text_len}", shot, start)
        except Exception as e:
            self._record("S06_kpi", "FAIL", str(e),
                         await self._screenshot("S06_err"), start)

    # ── S07: Chat ──────────────────────────────────────────────
    async def test_chat_page(self):
        start = await self._step("S07_chat")
        try:
            await self._set_vp("desktop")
            await self._go("/chat")
            shot = await self._screenshot("S07_chat")
            text_len = len(await self.page.evaluate("document.body.innerText"))
            self._record("S07_chat", "PASS" if text_len > 50 else "FAIL",
                         f"body chars: {text_len}", shot, start)
        except Exception as e:
            self._record("S07_chat", "FAIL", str(e),
                         await self._screenshot("S07_err"), start)

    # ── S08: Calendar ──────────────────────────────────────────
    async def test_calendar_page(self):
        start = await self._step("S08_calendar")
        try:
            await self._set_vp("desktop")
            await self._go("/calendar")
            shot = await self._screenshot("S08_calendar")
            text_len = len(await self.page.evaluate("document.body.innerText"))
            self._record("S08_calendar", "PASS" if text_len > 50 else "FAIL",
                         f"body chars: {text_len}", shot, start)
        except Exception as e:
            self._record("S08_calendar", "FAIL", str(e),
                         await self._screenshot("S08_err"), start)

    # ── S10: Mobile no-overflow across all routes ────────────
    async def test_mobile_no_overflow(self):
        start = await self._step("S10_mobile_overflow")
        try:
            await self._set_vp("mobile")
            bad: list[str] = []
            for path in ROUTES:
                await self._go(path, wait=0.6)
                sw = await self.page.evaluate("document.documentElement.scrollWidth")
                iw = await self.page.evaluate("window.innerWidth")
                if sw > iw + 4:
                    bad.append(f"{path}: scrollWidth={sw} > innerWidth={iw}")
            shot = await self._screenshot("S10_mobile_last")
            if bad:
                self._record("S10_mobile_overflow", "FAIL",
                             "; ".join(bad), shot, start)
            else:
                self._record("S10_mobile_overflow", "PASS",
                             f"all {len(ROUTES)} routes fit at 393px", shot, start)
        except Exception as e:
            self._record("S10_mobile_overflow", "FAIL", str(e),
                         await self._screenshot("S10_err"), start)

    # ── S11: Tablet no-overflow ──────────────────────────────
    async def test_tablet_no_overflow(self):
        start = await self._step("S11_tablet_overflow")
        try:
            await self._set_vp("tablet")
            bad: list[str] = []
            for path in ROUTES:
                await self._go(path, wait=0.6)
                sw = await self.page.evaluate("document.documentElement.scrollWidth")
                iw = await self.page.evaluate("window.innerWidth")
                if sw > iw + 4:
                    bad.append(f"{path}: {sw}>{iw}")
            shot = await self._screenshot("S11_tablet_last")
            if bad:
                self._record("S11_tablet_overflow", "FAIL",
                             "; ".join(bad), shot, start)
            else:
                self._record("S11_tablet_overflow", "PASS",
                             f"all {len(ROUTES)} routes fit at 768px", shot, start)
        except Exception as e:
            self._record("S11_tablet_overflow", "FAIL", str(e),
                         await self._screenshot("S11_err"), start)

    # ── S12: Demo banner present ──────────────────────────────
    async def test_demo_banner(self):
        start = await self._step("S12_demo_banner")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            shot = await self._screenshot("S12_demo_banner")
            body = await self.page.evaluate("document.body.innerText")
            ok = "DEMO" in body and "Reset" in body
            self._record("S12_demo_banner", "PASS" if ok else "FAIL",
                         f"banner found: {ok}", shot, start)
        except Exception as e:
            self._record("S12_demo_banner", "FAIL", str(e),
                         await self._screenshot("S12_err"), start)

    # ── S13: /api/demo/reset endpoint ─────────────────────────
    async def test_demo_reset_endpoint(self):
        start = await self._step("S13_demo_reset")
        try:
            await self._go("/dashboard")
            result = await self.page.evaluate(
                "fetch('/api/demo/reset', {method:'POST'}).then(r=>r.json())"
            )
            ok = bool(result.get("ok"))
            shot = await self._screenshot("S13_demo_reset")
            self._record("S13_demo_reset", "PASS" if ok else "FAIL",
                         f"resp={result}", shot, start)
        except Exception as e:
            self._record("S13_demo_reset", "FAIL", str(e),
                         await self._screenshot("S13_err"), start)

    # ── S14: Mobile burger opens drawer ───────────────────────
    async def test_mobile_drawer(self):
        start = await self._step("S14_mobile_drawer")
        try:
            await self._set_vp("mobile")
            await self._go("/dashboard")
            burger = self.page.locator("button[aria-label='Toggle menu']").first
            cnt = await burger.count()
            if cnt == 0:
                shot = await self._screenshot("S14_no_burger")
                self._record("S14_mobile_drawer", "FAIL",
                             "burger button not found", shot, start)
                return
            await burger.click()
            await asyncio.sleep(0.5)
            shot = await self._screenshot("S14_drawer_open")
            # backdrop exists when open
            backdrop_visible = await self.page.evaluate(
                "!!document.querySelector('.bg-black\\\\/50')"
            )
            self._record(
                "S14_mobile_drawer",
                "PASS" if backdrop_visible else "WARN",
                f"backdrop visible after burger click: {backdrop_visible}",
                shot, start,
            )
        except Exception as e:
            self._record("S14_mobile_drawer", "FAIL", str(e),
                         await self._screenshot("S14_err"), start)

    # ── S15: Desktop sidebar collapse ─────────────────────────
    async def test_desktop_collapse(self):
        start = await self._step("S15_desktop_collapse")
        try:
            await self._set_vp("desktop")
            await self._go("/dashboard")
            btn = self.page.locator("button[aria-label*='ollapse'], button[aria-label*='Expand']").first
            if await btn.count() == 0:
                shot = await self._screenshot("S15_no_btn")
                self._record("S15_desktop_collapse", "WARN",
                             "collapse button not found", shot, start)
                return
            await btn.click()
            await asyncio.sleep(0.3)
            shot = await self._screenshot("S15_collapsed")
            ls = await self.page.evaluate("localStorage.getItem('crm_sidebar')")
            self._record(
                "S15_desktop_collapse",
                "PASS" if ls in ("collapsed", "expanded") else "WARN",
                f"localStorage crm_sidebar={ls!r}",
                shot, start,
            )
        except Exception as e:
            self._record("S15_desktop_collapse", "FAIL", str(e),
                         await self._screenshot("S15_err"), start)

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
            self.test_mobile_no_overflow,
            self.test_tablet_no_overflow,
            self.test_demo_banner,
            self.test_demo_reset_endpoint,
            self.test_mobile_drawer,
            self.test_desktop_collapse,
        ]
        if only:
            wanted = {x.lower() for x in only}
            tests = [t for t in tests if any(w in t.__name__.lower() for w in wanted)]
        for t in tests:
            await t()
        return self.results
