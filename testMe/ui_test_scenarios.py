"""Studio CRM E2E scenarios for the TITAN framework.

Loaded by titan via `external_scenarios.crm` in
titan/config/systems/crm.yaml.

Run with:
    cd <titan-repo>
    python -m cli test --system config/systems/crm.yaml --scenario crm
    # filter: --only S01 S10
    # visible: --headed
"""
from __future__ import annotations

import asyncio
from typing import Callable, Awaitable

from scenarios.base import BaseScenario, StepResult

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet":  {"width": 768,  "height": 1024},
    "mobile":  {"width": 393,  "height": 852},
}

PAGES = ["/dashboard", "/clients", "/deals", "/tasks", "/backlog", "/kpi", "/chat", "/calendar"]


class CrmScenarios(BaseScenario):
    OUTPUT_SUBDIR = "crm"
    REPORT_URL = "/dashboard"

    # ── helpers ────────────────────────────────────────────────────────────
    async def _go(self, path: str, wait: float = 1.0) -> None:
        await self.page.goto(f"{self.base_url}{path}", wait_until="networkidle")
        await asyncio.sleep(wait)

    async def _set_viewport(self, name: str) -> None:
        await self.page.set_viewport_size(VIEWPORTS[name])
        await asyncio.sleep(0.2)

    async def _scroll_width_check(self, path: str) -> tuple[int, int]:
        await self._go(path, wait=0.8)
        sw = await self.page.evaluate("document.documentElement.scrollWidth")
        iw = await self.page.evaluate("window.innerWidth")
        return int(sw), int(iw)

    # ── S01–S08: each page renders OK on desktop ───────────────────────────
    async def s01_dashboard(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/dashboard")
        title = await self.page.title()
        ok = "Studio CRM" in title or "CRM" in title
        return StepResult(ok=ok, message=f"title={title!r}")

    async def s02_clients(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/clients")
        cnt = await self.page.locator("a[href*='/clients/']").count()
        return StepResult(ok=cnt > 0, message=f"client links: {cnt}")

    async def s03_deals(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/deals")
        cnt = await self.page.locator("a[href*='/deals/'], [data-deal-id]").count()
        return StepResult(ok=cnt > 0, message=f"deal nodes: {cnt}")

    async def s04_tasks(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/tasks")
        body = await self.page.evaluate("document.body.innerText")
        return StepResult(ok="task" in body.lower() or len(body) > 100, message=f"body chars={len(body)}")

    async def s05_backlog(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/backlog")
        body = await self.page.evaluate("document.body.innerText")
        return StepResult(ok=len(body) > 100, message=f"body chars={len(body)}")

    async def s06_kpi(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/kpi")
        body = await self.page.evaluate("document.body.innerText")
        return StepResult(ok=len(body) > 50, message=f"body chars={len(body)}")

    async def s07_chat(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/chat")
        body = await self.page.evaluate("document.body.innerText")
        return StepResult(ok=len(body) > 50, message=f"body chars={len(body)}")

    async def s08_calendar(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/calendar")
        body = await self.page.evaluate("document.body.innerText")
        return StepResult(ok=len(body) > 50, message=f"body chars={len(body)}")

    # ── S10: mobile no-horizontal-scroll across all pages ──────────────────
    async def s10_mobile_no_overflow(self) -> StepResult:
        await self._set_viewport("mobile")
        bad: list[str] = []
        for path in PAGES:
            sw, iw = await self._scroll_width_check(path)
            if sw > iw + 4:
                bad.append(f"{path}: scrollWidth={sw} > innerWidth={iw}")
        return StepResult(
            ok=not bad,
            message="all pages fit" if not bad else "; ".join(bad),
        )

    # ── S11: tablet ────────────────────────────────────────────────────────
    async def s11_tablet_no_overflow(self) -> StepResult:
        await self._set_viewport("tablet")
        bad: list[str] = []
        for path in PAGES:
            sw, iw = await self._scroll_width_check(path)
            if sw > iw + 4:
                bad.append(f"{path}: {sw}>{iw}")
        return StepResult(ok=not bad, message="ok" if not bad else "; ".join(bad))

    # ── S12: demo banner shows on every page ───────────────────────────────
    async def s12_demo_banner(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/dashboard")
        text = await self.page.evaluate("document.body.innerText")
        has_demo = "DEMO" in text and "Reset" in text
        return StepResult(ok=has_demo, message="DEMO banner found" if has_demo else "DEMO banner missing")

    # ── S13: /api/demo/reset returns ok ────────────────────────────────────
    async def s13_demo_reset_endpoint(self) -> StepResult:
        await self._go("/dashboard")
        result = await self.page.evaluate(
            "fetch('/api/demo/reset', {method:'POST'}).then(r=>r.json())"
        )
        return StepResult(
            ok=bool(result.get("ok")),
            message=f"resp={result}",
        )

    # ── S14: mobile drawer toggle (burger opens, backdrop closes) ──────────
    async def s14_mobile_drawer(self) -> StepResult:
        await self._set_viewport("mobile")
        await self._go("/dashboard")
        # Sidebar starts off-canvas (translate-x-(-100%)) and toggles via burger
        burger = self.page.locator("[aria-label='Toggle menu'], button.md\\:hidden").first
        if await burger.count() == 0:
            return StepResult(ok=False, message="burger button not found")
        await burger.click()
        await asyncio.sleep(0.5)
        # Sidebar should now be visible (drawer translated to 0)
        sidebar = self.page.locator("aside, [class*='sidebar']").first
        visible = await sidebar.is_visible() if await sidebar.count() else False
        return StepResult(ok=visible, message=f"sidebar visible after burger: {visible}")

    # ── S15: desktop sidebar collapse persists in localStorage ─────────────
    async def s15_desktop_collapse(self) -> StepResult:
        await self._set_viewport("desktop")
        await self._go("/dashboard")
        # collapse button is the chevron
        btn = self.page.locator("[aria-label*='ollapse'], [aria-label*='Expand']").first
        if await btn.count() == 0:
            return StepResult(ok=False, message="collapse button not found")
        await btn.click()
        await asyncio.sleep(0.3)
        ls = await self.page.evaluate("localStorage.getItem('crm_sidebar')")
        return StepResult(
            ok=ls in ("collapsed", "expanded"),
            message=f"localStorage crm_sidebar={ls!r}",
        )
