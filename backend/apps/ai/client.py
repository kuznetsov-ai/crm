"""Unified LLM client: auto-selects a provider based on available env vars.

Supported providers (selection priority if AI_PROVIDER is not set):
  1. anthropic  (ANTHROPIC_API_KEY)                      — Claude Sonnet
  2. deepseek   (DEEPSEEK_API_KEY)                       — OpenAI-compatible
  3. openai     (OPENAI_API_KEY + optional OPENAI_API_BASE)
                                                          Works with OpenAI,
                                                          Groq, Together, OpenRouter, Moonshot, etc.
  4. gemini     (GEMINI_API_KEY / GOOGLE_API_KEY)        — Gemini 2.0 Flash
  5. stub       (nothing configured)                     — dev-only placeholder

Set AI_PROVIDER=<name> to force a specific backend. Set AI_MODEL=<id> to override
the default model name for the chosen provider.

Why this shape?  Outstaff CRMs rarely need frontier reasoning — short structured
outputs (deal summaries, email drafts, sentiment JSON) work well on cheap fast
models like deepseek-v4-flash or gemini-2.0-flash. The wrapper lets you swap without
touching view code.
"""
import os
from typing import Optional


DEFAULT_MODELS = {
    'anthropic': 'claude-sonnet-4-6',
    'deepseek': 'deepseek-v4-flash',
    'openai': 'gpt-4o-mini',
    'gemini': 'gemini-2.0-flash',
}


def _env(*names: str) -> Optional[str]:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return None


def detect_provider() -> str:
    forced = os.environ.get('AI_PROVIDER', '').strip().lower()
    if forced:
        return forced
    if os.environ.get('ANTHROPIC_API_KEY'):
        return 'anthropic'
    if os.environ.get('DEEPSEEK_API_KEY'):
        return 'deepseek'
    if os.environ.get('OPENAI_API_KEY'):
        return 'openai'
    if _env('GEMINI_API_KEY', 'GOOGLE_API_KEY'):
        return 'gemini'
    return 'stub'


def provider_info() -> dict:
    p = detect_provider()
    model = os.environ.get('AI_MODEL') or DEFAULT_MODELS.get(p, '')
    return {'provider': p, 'model': model}


def call_claude(system: str, user: str, model: str = '', max_tokens: int = 1024) -> str:
    """Backward-compatible entry point. Dispatches to the selected provider."""
    provider = detect_provider()
    resolved_model = model or os.environ.get('AI_MODEL') or DEFAULT_MODELS.get(provider, '')
    try:
        if provider == 'anthropic':
            return _call_anthropic(system, user, resolved_model, max_tokens)
        if provider == 'deepseek':
            return _call_openai_compatible(
                system, user, resolved_model or 'deepseek-v4-flash', max_tokens,
                api_key=os.environ['DEEPSEEK_API_KEY'],
                base_url='https://api.deepseek.com/v1',
                extra_body={'thinking': {'type': 'disabled'}},
            )
        if provider == 'openai':
            return _call_openai_compatible(
                system, user, resolved_model or 'gpt-4o-mini', max_tokens,
                api_key=os.environ['OPENAI_API_KEY'],
                base_url=os.environ.get('OPENAI_API_BASE') or None,
            )
        if provider == 'gemini':
            return _call_gemini(system, user, resolved_model or 'gemini-2.0-flash', max_tokens)
    except Exception as exc:
        # Surface the error inside the AI output rather than 500'ing the UI
        return f'[AI error — provider={provider}, model={resolved_model}]\n{type(exc).__name__}: {exc}'

    return _local_stub(system, user)


def _call_anthropic(system: str, user: str, model: str, max_tokens: int) -> str:
    from anthropic import Anthropic  # type: ignore
    client = Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    message = client.messages.create(
        model=model or 'claude-sonnet-4-6',
        max_tokens=max_tokens,
        system=system,
        messages=[{'role': 'user', 'content': user}],
    )
    parts: list[str] = []
    for block in message.content:
        text = getattr(block, 'text', None)
        if text:
            parts.append(text)
    return '\n'.join(parts).strip()


def _call_openai_compatible(
    system: str,
    user: str,
    model: str,
    max_tokens: int,
    *,
    api_key: str,
    base_url: Optional[str] = None,
    extra_body: Optional[dict] = None,
) -> str:
    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=api_key, base_url=base_url)
    kwargs = {
        'model': model,
        'max_tokens': max_tokens,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ],
    }
    if extra_body:
        kwargs['extra_body'] = extra_body
    response = client.chat.completions.create(**kwargs)
    if not response.choices:
        return ''
    return (response.choices[0].message.content or '').strip()


def _call_gemini(system: str, user: str, model: str, max_tokens: int) -> str:
    import google.generativeai as genai  # type: ignore
    api_key = _env('GEMINI_API_KEY', 'GOOGLE_API_KEY')
    if not api_key:
        return _local_stub(system, user)
    genai.configure(api_key=api_key)
    # Gemini 2.x supports system_instruction
    gen_model = genai.GenerativeModel(model_name=model, system_instruction=system)
    response = gen_model.generate_content(
        user,
        generation_config={'max_output_tokens': max_tokens, 'temperature': 0.4},
    )
    return (getattr(response, 'text', '') or '').strip()


def _local_stub(system: str, user: str) -> str:
    preview = user.strip().split('\n')[0][:120]
    return (
        "[AI stub — no provider key set. Configure one of:\n"
        "  ANTHROPIC_API_KEY  (Claude)\n"
        "  DEEPSEEK_API_KEY   (DeepSeek, cheap, OpenAI-compatible)\n"
        "  OPENAI_API_KEY (+ optional OPENAI_API_BASE for Groq/Together/OpenRouter/Moonshot)\n"
        "  GEMINI_API_KEY     (Google Gemini 2.0 Flash, very cheap + free tier)\n"
        "Optionally AI_PROVIDER=<name> and AI_MODEL=<id> to override defaults.]\n\n"
        f"System: {system[:80]}...\n"
        f"Input preview: {preview}\n\n"
        "Ожидаемый формат ответа:\n"
        "• Краткое резюме состояния сделки (2–3 предложения)\n"
        "• Следующий шаг\n"
        "• Риски/блокеры"
    )


def build_deal_context(deal) -> str:
    """Serialize a Deal into a compact text context for the LLM."""
    from apps.tasks.models import Task

    parts: list[str] = []
    parts.append(f"Deal: {deal.title}")
    parts.append(f"Client: {deal.client.name} (industry: {deal.client.industry or '—'}, country: {deal.client.country or '—'})")
    parts.append(f"Status: {deal.get_status_display()}")
    parts.append(f"Value: ${deal.value_usd}")
    parts.append(f"Probability: {deal.probability}%")
    if deal.assigned_to:
        parts.append(f"Assigned: {deal.assigned_to.full_name or deal.assigned_to.email}")
    if deal.expected_close_date:
        parts.append(f"Expected close: {deal.expected_close_date}")
    if deal.tech_requirements:
        parts.append(f"Tech requirements: {', '.join(map(str, deal.tech_requirements))}")
    if deal.description:
        parts.append(f"Description: {deal.description}")

    notes = list(deal.notes.filter(is_deleted=False).order_by('-created_at')[:10])
    if notes:
        parts.append("\nRecent notes:")
        for n in notes:
            who = n.author.full_name if n.author else 'unknown'
            parts.append(f"- [{n.created_at:%Y-%m-%d} {who}] {n.text[:300]}")

    tasks = list(Task.objects.filter(linked_deal=deal).order_by('-created_at')[:10])
    if tasks:
        parts.append("\nLinked tasks:")
        for tk in tasks:
            parts.append(f"- [{tk.status}/{tk.priority}] {tk.title}")

    return '\n'.join(parts)
