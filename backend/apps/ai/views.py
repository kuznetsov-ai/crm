import json
import re
from urllib.parse import urlparse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils import timezone
from apps.deals.models import Deal
from apps.chat.models import ChatChannel, ChatMessage
from apps.tasks.models import Task
from .client import call_claude, build_deal_context, provider_info
from .bench import bench_roster


def _language_instruction(user) -> str:
    """Return a hard language directive for the system prompt based on the user's UI language."""
    lang = getattr(user, 'language', 'ru') or 'ru'
    if lang == 'ru':
        return (
            "CRITICAL: Write the entire response in RUSSIAN. "
            "All labels, headings, bullets, and narrative must be in Russian. "
            "Do not mix languages. This overrides any language from the input context."
        )
    return (
        "CRITICAL: Write the entire response in ENGLISH. "
        "Do not mix languages."
    )


DEAL_SUMMARY_SYSTEM_BASE = (
    "You are a senior B2B sales coach assistant inside a CRM. "
    "Given a deal context, produce a concise status update in 3 sections: "
    "(1) Where we are (2–3 sentences), (2) Next best action (single imperative sentence), "
    "(3) Risks & blockers (bullet list, max 4 items). "
    "Be specific and use facts from the context — do not invent."
)


DRAFT_EMAIL_PRESETS = {
    'follow_up': (
        "Draft a short, friendly B2B follow-up email to the client after a recent conversation. "
        "Acknowledge last contact, restate value, propose a concrete next step with a date option."
    ),
    'reminder': (
        "Draft a polite reminder email about a pending decision or deliverable from the client. "
        "Keep it non-pushy but concrete: reference the specific item and suggest a deadline."
    ),
    'proposal_intro': (
        "Draft an introductory email accompanying a proposal/SOW. "
        "Summarize the scope, key deliverables, and set expectations for review timeline."
    ),
    'meeting_request': (
        "Draft a short email proposing a 30-minute meeting next week. "
        "Offer 2–3 specific time slots and a clear agenda."
    ),
}

DRAFT_EMAIL_SYSTEM_BASE = (
    "You are an experienced B2B account executive. Draft a single email based on the preset purpose. "
    "Output format:\n"
    "Subject: <subject line>\n\n"
    "<body>\n\n"
    "Sign with just [Your name]. Keep it under 150 words."
)


class DealSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, deal_id: int):
        try:
            deal = Deal.objects.select_related('client', 'assigned_to').get(pk=deal_id)
        except Deal.DoesNotExist:
            return Response({'error': 'Deal not found'}, status=status.HTTP_404_NOT_FOUND)

        context = build_deal_context(deal)
        system = DEAL_SUMMARY_SYSTEM_BASE + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=context, max_tokens=700)
        return Response({'summary': answer, 'deal_id': deal.id})


class DraftEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, deal_id: int):
        preset = request.data.get('preset', 'follow_up')
        tone = request.data.get('tone', 'professional')
        if preset not in DRAFT_EMAIL_PRESETS:
            return Response({'error': f'Unknown preset "{preset}"'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            deal = Deal.objects.select_related('client', 'assigned_to').get(pk=deal_id)
        except Deal.DoesNotExist:
            return Response({'error': 'Deal not found'}, status=status.HTTP_404_NOT_FOUND)

        context = build_deal_context(deal)
        user_prompt = (
            f"Preset: {preset}\n"
            f"Tone: {tone}\n"
            f"Preset instructions: {DRAFT_EMAIL_PRESETS[preset]}\n\n"
            f"Deal context:\n{context}"
        )
        system = DRAFT_EMAIL_SYSTEM_BASE + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=user_prompt, max_tokens=500)
        return Response({'draft': answer, 'preset': preset})


# ─── Sentiment: chat channel tone analysis ──────────────────────────────────

SENTIMENT_SYSTEM = (
    "You analyze the tone of a B2B chat conversation and produce a single JSON object with keys: "
    "sentiment (one of: positive, neutral, mixed, negative, at_risk), "
    "score (-100..100), "
    "reason (short — why), "
    "signals (array of strings — specific phrases that drove the score), "
    "recommended_action (short — what the manager should do next). "
    "Return ONLY the JSON, no wrapper text."
)


class ChatSentimentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id: int):
        try:
            channel = ChatChannel.objects.get(pk=channel_id, members=request.user)
        except ChatChannel.DoesNotExist:
            return Response({'error': 'Channel not found or not a member'}, status=status.HTTP_404_NOT_FOUND)

        messages = list(channel.messages.select_related('author').order_by('-created_at')[:50])
        messages.reverse()
        if not messages:
            return Response({'sentiment': 'neutral', 'score': 0, 'reason': 'no messages', 'signals': [], 'recommended_action': ''})

        lines = []
        for m in messages:
            who = m.author.full_name if m.author else 'system'
            attach = f' [file: {m.attachment_name}]' if m.attachment_name else ''
            lines.append(f'[{m.created_at:%Y-%m-%d %H:%M}] {who}: {m.text}{attach}')
        convo = '\n'.join(lines)

        system = SENTIMENT_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=convo, max_tokens=400)
        # Try to parse JSON; fall back to raw
        parsed = _safe_json(answer)
        if parsed is None:
            parsed = {'sentiment': 'neutral', 'score': 0, 'reason': 'AI response was not JSON', 'signals': [], 'recommended_action': '', 'raw': answer}
        parsed['messages_analyzed'] = len(messages)
        return Response(parsed)


# ─── Lead enrichment: domain → company profile ──────────────────────────────

LEAD_ENRICH_SYSTEM = (
    "You are a B2B research analyst. Based on raw text scraped from several pages of a company's website "
    "(homepage + contact/about/team pages + already-extracted emails/phones/socials), "
    "return a JSON object with: "
    "name, industry, description (1–2 sentences), "
    "company_size_estimate (one of: '1-10','11-50','51-200','200+','unknown'), "
    "countries (array), tech_stack (array of technologies mentioned or inferred), "
    "products (array of key products/services), "
    "potential_outstaff_fit (string — rationale why an outstaff IT partner could help them), "
    "contacts (array of people found in the text: "
    "each item = {full_name, position, email (if known), phone (if known), linkedin (if known), is_decision_maker: true|false}). "
    "ALSO pick the most likely general email and phone (company-level, not a person's) as "
    "primary_email and primary_phone. "
    "Only use facts from the provided text. If information is unclear, use null or 'unknown' or []. "
    "Return ONLY the JSON."
)


class RuCompanyView(APIView):
    """POST /api/ai/ru-company/ with {inn} → ЕГРЮЛ + (optional) Dadata financials.

    ЕГРЮЛ via egrul.itsoft.ru is free/no-auth.
    Financial figures are added only if DADATA_API_KEY is configured.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .ru_company import fetch_egrul, fetch_dadata_financials
        inn = (request.data.get('inn') or '').strip()
        if not inn:
            return Response({'error': 'inn required'}, status=status.HTTP_400_BAD_REQUEST)
        egrul = fetch_egrul(inn)
        financials = fetch_dadata_financials(inn)
        return Response({'egrul': egrul, 'financials': financials, 'inn': inn})


class HhSearchView(APIView):
    """POST /api/ai/hh-search/ — public HH autocomplete (no OAuth required).

    Body: {"query": "Тинькофф"} → {results: [{hh_id, name, domain, logo, hh_page}]}
    We use /suggests/employers (public) because /employers requires OAuth now.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .hh import suggest_employers
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'results': [], 'error': 'query required'}, status=status.HTTP_400_BAD_REQUEST)
        rows = suggest_employers(query, limit=10)
        return Response({'results': rows, 'query': query})


class LeadEnrichView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_domain = (request.data.get('domain') or '').strip()
        if not raw_domain:
            return Response({'error': 'domain required'}, status=status.HTTP_400_BAD_REQUEST)
        domain = _normalize_domain(raw_domain)

        # Scrape multiple pages (home + common "contact/about/team" paths)
        pages = _fetch_company_pages(domain)
        if not pages:
            return Response({
                'domain': domain,
                'enriched': None,
                'error': 'Could not fetch site. Check that the host is reachable from the backend container.',
            })

        combined_text = ''
        for path, html in pages.items():
            text = _html_to_text(html)
            combined_text += f'\n\n--- page: {path} ---\n{text[:6000]}'

        # Regex-extract contact signals from all raw HTML (LLM-independent)
        all_html = '\n'.join(pages.values())
        extracted = _extract_contacts(all_html)

        user_prompt = (
            f"Domain: {domain}\n\n"
            f"Already extracted from HTML (verified signals — prefer these over guesses):\n"
            f"  emails: {extracted['emails']}\n"
            f"  phones: {extracted['phones']}\n"
            f"  linkedin_urls: {extracted['linkedin_urls']}\n"
            f"  social_urls: {extracted['social_urls']}\n\n"
            f"Combined text from scraped pages:\n{combined_text[:18000]}"
        )
        system = LEAD_ENRICH_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=user_prompt, max_tokens=1500)
        parsed = _safe_json(answer) or {'raw': answer}
        parsed['domain'] = domain
        parsed.setdefault('scraped_pages', list(pages.keys()))
        # Ensure regex-found contacts are present even if LLM misses them
        if 'contacts' not in parsed or not parsed['contacts']:
            parsed['contacts'] = _build_fallback_contacts(extracted)
        # Merge raw regex data for the UI to display alongside
        parsed['raw_signals'] = extracted
        return Response({'enriched': parsed})


# ─── Next best action: dashboard for current user ───────────────────────────

NEXT_BEST_ACTION_SYSTEM = (
    "You are a sales operations AI coach. Given a sales rep's current pipeline snapshot, "
    "produce a JSON object: {actions: [ { title, rationale, impact: 'high'|'medium'|'low', entity_type, entity_id } ]} "
    "with UP TO 5 ranked concrete actions for today, ordered by impact. "
    "Each action should be one imperative sentence. Use facts from the snapshot only. "
    "Return ONLY the JSON."
)


class NextBestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        now = timezone.now()

        my_deals = list(
            Deal.objects.filter(assigned_to=user)
                .exclude(status__in=['closed', 'lost'])
                .select_related('client')
                .order_by('-updated_at')[:30]
        )
        my_tasks = list(
            Task.objects.filter(assigned_to=user)
                .exclude(status='done')
                .order_by('deadline')[:30]
        )

        lines: list[str] = [f"Rep: {user.full_name or user.email}", f"Today: {now:%Y-%m-%d}"]
        lines.append("\nOpen deals:")
        for d in my_deals:
            last_update_days = (now - d.updated_at).days
            close = d.expected_close_date.isoformat() if d.expected_close_date else 'n/a'
            lines.append(
                f"- [id={d.id}] {d.title} · client={d.client.name} · status={d.status} · "
                f"${d.value_usd} · last_update={last_update_days}d ago · expected_close={close}"
            )
        lines.append("\nOpen tasks:")
        for tk in my_tasks:
            overdue = tk.deadline and tk.deadline.replace(tzinfo=now.tzinfo) < now
            dl = tk.deadline.isoformat() if tk.deadline else 'n/a'
            lines.append(f"- [id={tk.id}] {tk.title} · priority={tk.priority} · status={tk.status} · deadline={dl}{' OVERDUE' if overdue else ''}")

        snapshot = '\n'.join(lines)
        system = NEXT_BEST_ACTION_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=snapshot, max_tokens=900)
        parsed = _safe_json(answer) or {'actions': [], 'raw': answer}
        parsed['pipeline'] = {
            'open_deals': len(my_deals),
            'open_tasks': len(my_tasks),
            'overdue_tasks': sum(1 for tk in my_tasks if tk.deadline and tk.deadline.replace(tzinfo=now.tzinfo) < now),
        }
        return Response(parsed)


# ─── Bench / utilization (stub data until HR integration) ──────────────────

class BenchRosterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roster = bench_roster()
        bench_count = sum(1 for r in roster if r['utilization_pct'] < 50)
        avg_util = round(sum(r['utilization_pct'] for r in roster) / len(roster), 1) if roster else 0
        return Response({
            'roster': roster,
            'totals': {'count': len(roster), 'bench_count': bench_count, 'avg_utilization_pct': avg_util},
        })


# ─── Resource matching: deal → candidate picks ─────────────────────────────

RESOURCE_MATCH_SYSTEM = (
    "You are a staffing coordinator for an IT outstaff agency. "
    "Given a deal with tech requirements and a bench roster (consultants with skills, role, utilization, roll-off date), "
    "pick up to 5 best-fit consultants for that deal. "
    "Return a JSON object: {picks: [ {user_id, name, role, match_reason, skill_overlap: []} ]}. "
    "Rank by fit: prefer consultants with overlapping skills AND low utilization (bench). "
    "If a consultant's role doesn't match the seniority needed, skip them. "
    "Return ONLY the JSON."
)


class ResourceMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, deal_id: int):
        try:
            deal = Deal.objects.select_related('client').get(pk=deal_id)
        except Deal.DoesNotExist:
            return Response({'error': 'Deal not found'}, status=status.HTTP_404_NOT_FOUND)

        roster = bench_roster()
        context = (
            f"Deal: {deal.title}\n"
            f"Client: {deal.client.name}\n"
            f"Tech requirements: {', '.join(map(str, deal.tech_requirements)) if deal.tech_requirements else '—'}\n"
            f"Team size needed: {deal.team_size_needed}\n\n"
            f"Description: {deal.description}\n\n"
            f"Bench roster ({len(roster)} consultants):\n"
        )
        for r in roster[:30]:  # cap input
            context += (
                f"- user_id={r['user_id']} · {r['name']} · role={r['role']} · "
                f"skills=[{', '.join(r['skills'])}] · utilization={r['utilization_pct']}% · "
                f"rolloff={r['rolloff_date'] or 'n/a'}\n"
            )

        system = RESOURCE_MATCH_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=context, max_tokens=900)
        parsed = _safe_json(answer) or {'picks': [], 'raw': answer}
        return Response(parsed)


# ─── AI candidate matching: HR mirror for a client profile ─────────────────

CANDIDATE_MATCH_SYSTEM = (
    "You are a sourcing analyst at an IT outstaff agency. "
    "Given a client profile (industry, tech stack, budget, country), "
    "describe the ideal candidate profile to pitch: role, seniority, required skills, nice-to-haves, "
    "culture fit indicators, and a 2-line sourcing brief a recruiter can paste into hh.ru/LinkedIn. "
    "Return JSON: {role, seniority, required_skills: [], nice_to_have: [], culture_fit, sourcing_brief}. "
    "Return ONLY the JSON."
)


class CandidateMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, client_id: int):
        from apps.clients.models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        tech = ', '.join(map(str, client.tech_stack)) if client.tech_stack else '—'
        context = (
            f"Client: {client.name}\n"
            f"Industry: {client.industry or '—'}\n"
            f"Country: {client.country or '—'}\n"
            f"Company size: {client.company_size or '—'}\n"
            f"Budget range: {client.budget_range or '—'}\n"
            f"Tech stack: {tech}\n"
            f"Description: {client.description}\n"
        )
        system = CANDIDATE_MATCH_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=context, max_tokens=800)
        parsed = _safe_json(answer) or {'raw': answer}
        return Response(parsed)


# ─── Meeting transcription: lightweight Fireflies integration ──────────────

TRANSCRIPT_SUMMARIZE_SYSTEM = (
    "You analyze a raw meeting transcript and return a JSON object: "
    "{summary: string (3-5 sentences), decisions: [string], action_items: [{ title, owner?, deadline? }], "
    "open_questions: [string], sentiment: one of (positive, neutral, mixed, negative)}. "
    "Owners/deadlines only when literally stated. Return ONLY the JSON."
)


class TranscriptProcessView(APIView):
    """Accepts a raw transcript (paste or uploaded) and returns structured output.

    The heavy lifting (Zoom/Teams/Fireflies integration) lives outside the CRM —
    this endpoint assumes the transcript text is already available. That keeps
    the CRM decoupled from any one meeting provider and plays well with the
    user's existing Fireflies skill.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        transcript = (request.data.get('transcript') or '').strip()
        if not transcript:
            return Response({'error': 'transcript required'}, status=status.HTTP_400_BAD_REQUEST)
        client_id = request.data.get('client_id')
        deal_id = request.data.get('deal_id')

        # Ask the LLM
        prompt = transcript[:20000]  # cap
        system = TRANSCRIPT_SUMMARIZE_SYSTEM + '\n\n' + _language_instruction(request.user)
        answer = call_claude(system=system, user=prompt, max_tokens=1200)
        parsed = _safe_json(answer) or {'raw': answer}

        saved_note_id = None
        if client_id and parsed.get('summary'):
            from apps.clients.models import Client, ClientNote
            try:
                client = Client.objects.get(pk=client_id)
                note = ClientNote.objects.create(
                    client=client,
                    kind='transcript',
                    title=f'Meeting transcript {timezone.now():%Y-%m-%d}',
                    body=_format_transcript_note(parsed, transcript),
                    author=request.user,
                )
                saved_note_id = note.id
            except Client.DoesNotExist:
                pass

        parsed['saved_note_id'] = saved_note_id
        parsed['deal_id'] = deal_id
        return Response(parsed)


def _format_transcript_note(parsed: dict, transcript: str) -> str:
    parts = []
    if parsed.get('summary'):
        parts.append(f"Summary:\n{parsed['summary']}")
    if parsed.get('decisions'):
        parts.append("Decisions:\n" + '\n'.join(f'• {d}' for d in parsed['decisions']))
    if parsed.get('action_items'):
        lines = []
        for a in parsed['action_items']:
            line = f"• {a.get('title', '')}"
            if a.get('owner'):
                line += f" — {a['owner']}"
            if a.get('deadline'):
                line += f" (due {a['deadline']})"
            lines.append(line)
        parts.append("Action items:\n" + '\n'.join(lines))
    if parsed.get('open_questions'):
        parts.append("Open questions:\n" + '\n'.join(f'? {q}' for q in parsed['open_questions']))
    parts.append("\n--- Full transcript (truncated) ---\n" + transcript[:2000])
    return '\n\n'.join(parts)


# ─── Provider info (so UI can show which model is answering) ───────────────

class ProviderInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(provider_info())


# ─── helpers ────────────────────────────────────────────────────────────────

def _safe_json(text: str) -> dict | None:
    """Try to parse JSON from an AI response, trimming code-fences if present."""
    text = text.strip()
    # Remove ``` fences
    fence = re.match(r'^```(?:json)?\s*(.*?)\s*```$', text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # Find first "{...}" block
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = text[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def _normalize_domain(raw: str) -> str:
    if '://' not in raw:
        raw = 'https://' + raw
    parsed = urlparse(raw)
    return parsed.netloc or parsed.path


def _fetch_homepage(domain: str) -> str | None:
    try:
        import requests  # type: ignore
    except ImportError:
        return None
    for scheme in ('https', 'http'):
        try:
            r = requests.get(f'{scheme}://{domain}', timeout=8, headers={'User-Agent': 'StudioCRM/1.0 (+lead-enrich)'})
            if r.status_code == 200 and r.text:
                return r.text
        except Exception:
            continue
    return None


COMMON_CONTACT_PATHS = [
    '', 'contact', 'contacts', 'contact-us', 'about', 'about-us',
    'team', 'our-team', 'company', 'impressum', 'imprint',
    'ru/contacts', 'en/contact',
]


def _fetch_company_pages(domain: str, max_pages: int = 5) -> dict[str, str]:
    """Fetch a small set of candidate pages. Returns {path: html}."""
    try:
        import requests  # type: ignore
    except ImportError:
        return {}
    pages: dict[str, str] = {}
    for scheme in ('https', 'http'):
        base = f'{scheme}://{domain}'
        for path in COMMON_CONTACT_PATHS:
            if len(pages) >= max_pages:
                break
            url = f'{base}/{path}' if path else base
            try:
                r = requests.get(url, timeout=6, headers={'User-Agent': 'StudioCRM/1.0 (+lead-enrich)'})
            except Exception:
                continue
            if r.status_code == 200 and r.text and 'html' in (r.headers.get('content-type') or '').lower():
                pages[path or '/'] = r.text
        if pages:
            return pages
    return pages


_EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
# Phone: require at least one space / dash / paren / + between digit groups
# to avoid SVG floats; international format or classic (###) ###-#### style.
_PHONE_RE = re.compile(r'(?:\+\d{1,3}[\s\-.]?)?(?:\(\d{2,4}\)[\s\-.]?)?\d{2,4}[\s\-.]\d{2,4}[\s\-.]?\d{0,4}')
_LINKEDIN_RE = re.compile(r'https?://(?:www\.)?linkedin\.com/[^\s"\'<>]+', re.IGNORECASE)
_SOCIAL_RE = re.compile(r'https?://(?:www\.)?(?:facebook|twitter|x|instagram|t|telegram|wa|whatsapp|youtube|tiktok)\.com/[^\s"\'<>]+', re.IGNORECASE)
_JUNK_EMAIL_PATTERNS = ('@sentry', '@wix', '@example', 'noreply@', 'no-reply@', 'donotreply@', '@w3.org', '@x.', '@sha256')


def _extract_contacts(html: str) -> dict:
    """Regex out emails, phones, and social links from raw HTML.

    Strips <svg>...</svg> and <script>...</script> blocks first to kill noise
    from SVG path coordinates ("21.944 3.069") and inline JS data.
    """
    cleaned = re.sub(r'<svg[\s\S]*?</svg>', ' ', html, flags=re.IGNORECASE)
    cleaned = re.sub(r'<script[\s\S]*?</script>', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<style[\s\S]*?</style>', ' ', cleaned, flags=re.IGNORECASE)

    emails = sorted(set(_EMAIL_RE.findall(cleaned)))
    emails = [e for e in emails if not any(junk in e.lower() for junk in _JUNK_EMAIL_PATTERNS)]

    # Also check for `tel:` and `mailto:` anchors even if the link text is formatted differently
    tel_links = re.findall(r'(?:href|data-phone)\s*=\s*["\']tel:([^"\']+)', cleaned, re.IGNORECASE)
    mail_links = re.findall(r'(?:href)\s*=\s*["\']mailto:([^"\'?]+)', cleaned, re.IGNORECASE)
    emails = sorted(set(emails) | set(mail_links))
    emails = [e for e in emails if not any(junk in e.lower() for junk in _JUNK_EMAIL_PATTERNS)]

    # Phones: only trust `tel:` anchors (too much noise otherwise: SVG paths, CSS transitions, hashes)
    # and +XX ... patterns that show up as visible text in a narrow textual window.
    text_only = re.sub(r'<[^>]+>', ' ', cleaned)
    text_phone_matches = re.findall(r'\+\d{1,3}[\s\-.]?\(?\d{2,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}', text_only)
    phones_raw = list(tel_links) + text_phone_matches
    normalized: set[str] = set()
    phones: list[str] = []
    for p in phones_raw:
        s = p.strip()
        digits = re.sub(r'\D', '', s)
        if len(digits) < 8 or len(digits) > 15:
            continue
        if digits in normalized:
            continue
        normalized.add(digits)
        phones.append(s)

    linkedin = sorted(set(_LINKEDIN_RE.findall(cleaned)))
    social = sorted(set(_SOCIAL_RE.findall(cleaned)))
    return {
        'emails': emails[:20],
        'phones': phones[:15],
        'linkedin_urls': linkedin[:15],
        'social_urls': social[:15],
    }


def _build_fallback_contacts(extracted: dict) -> list[dict]:
    """If the LLM did not return people, at least surface raw emails/phones as contacts."""
    out: list[dict] = []
    emails = extracted.get('emails') or []
    phones = extracted.get('phones') or []
    linkedin = extracted.get('linkedin_urls') or []
    if not emails and not phones and not linkedin:
        return out
    # Make one "primary contact" entry bundling everything we have
    out.append({
        'full_name': '',
        'position': '',
        'email': emails[0] if emails else '',
        'phone': phones[0] if phones else '',
        'linkedin': linkedin[0] if linkedin else '',
        'is_decision_maker': False,
    })
    # Additional emails as separate entries
    for e in emails[1:5]:
        out.append({'full_name': '', 'position': '', 'email': e, 'phone': '', 'linkedin': '', 'is_decision_maker': False})
    return out


def _html_to_text(html: str) -> str:
    # Minimal strip — no BeautifulSoup dependency.
    # Remove scripts/styles.
    html = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.IGNORECASE)
    html = re.sub(r'<style[\s\S]*?</style>', ' ', html, flags=re.IGNORECASE)
    # Replace tags with spaces
    text = re.sub(r'<[^>]+>', ' ', html)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text
