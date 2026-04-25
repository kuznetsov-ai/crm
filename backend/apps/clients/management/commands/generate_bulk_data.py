"""Bulk-generate diverse demo data across all CRM entities.

Usage:
    python manage.py generate_bulk_data           # add on top of what's there
    python manage.py generate_bulk_data --wipe    # delete everything demo-marked first

Adds:
  * 10 employees with roles + SalesPlans + KPI targets
  * 30 clients across industries/sizes/statuses + contacts, notes, rate cards
  * 50 deals across all pipeline stages + deal notes
  * 80 tasks (various statuses/priorities, some overdue, linked to clients/deals)
  * 20 backlog ideas with votes + comments
  * 60 calendar events (past, present, future; event/reminder/busy)
  * 4 chat channels with 150 messages total
"""
from __future__ import annotations

import random
from datetime import timedelta, date

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


INDUSTRIES = [
    "FinTech", "HealthTech", "E-commerce", "SaaS", "EdTech", "AI/ML",
    "GameDev", "MediaTech", "Logistics", "PropTech", "InsurTech",
    "Cybersecurity", "IoT", "Travel", "Retail", "Telecom",
]
COUNTRIES = ["USA", "UK", "Germany", "Netherlands", "UAE", "Singapore",
             "Cyprus", "Estonia", "Switzerland", "Israel"]
COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"]
CLIENT_STATUSES = ["lead", "prospect", "active", "active", "paused", "churned"]
BUDGETS = ["small", "medium", "large", "enterprise"]
RISK_LEVELS = ["low", "low", "low", "medium", "medium", "high", "critical"]
TECH_STACKS = [
    ["Python", "Django", "PostgreSQL"],
    ["Node.js", "React", "MongoDB"],
    ["Go", "Kubernetes", "gRPC"],
    ["Java", "Spring Boot", "Oracle"],
    ["TypeScript", "Next.js", "Tailwind"],
    ["Rust", "Actix", "Redis"],
    ["Elixir", "Phoenix", "PostgreSQL"],
    ["Ruby", "Rails", "MySQL"],
    ["Swift", "iOS", "SwiftUI"],
    ["Kotlin", "Android", "Jetpack Compose"],
]
CLIENT_NAME_POOL = [
    "Nexora", "Cordite", "Quintal", "Verra", "Zephyr", "Kintsugi",
    "Polymath", "Anchorline", "Sablefox", "Triskele", "Meridian",
    "Cascadia", "Nimbus", "Solstice", "Orbital", "Pikestaff",
    "Vellum", "Fathom", "Luminary", "Ironclad", "Spire", "Helios",
    "Aurelia", "Braxton", "Caelum", "Dovetail", "Echelon", "Figment",
    "Halcyon", "Inkwell",
]
SUFFIX_POOL = [
    "Labs", "Systems", "Digital", "Technologies", "Ventures", "Capital",
    "Group", "Dynamics", "Works", "Analytics", "Networks", "Studios",
]

FIRST_NAMES_RU = ["Евгений", "Анна", "Михаил", "Ольга", "Дмитрий", "Екатерина",
                  "Сергей", "Мария", "Андрей", "Наталья", "Артём", "Юлия"]
LAST_NAMES_RU = ["Кузнецов", "Иванова", "Петров", "Сидорова", "Попов",
                 "Морозова", "Новиков", "Лебедева", "Соколов", "Волкова"]
FIRST_NAMES_EN = ["John", "Sarah", "Michael", "Emily", "David", "Jessica",
                  "Robert", "Laura", "Chris", "Anna"]
LAST_NAMES_EN = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller",
                 "Davis", "Garcia", "Wilson", "Anderson"]

CONTACT_ROLES = ["decision_maker", "manager", "secretary", "other"]

DEAL_STAGES = ["new_lead", "discovery", "proposal", "negotiation",
               "signed", "active", "closed", "lost"]
DEAL_TITLES = [
    "Team augmentation — 3 backend devs",
    "Mobile app MVP",
    "AI chatbot POC",
    "Platform rearchitecture",
    "DevOps overhaul",
    "Data pipeline modernization",
    "Analytics dashboard build",
    "Cloud migration (AWS → GCP)",
    "Embedded firmware project",
    "Internal tooling suite",
    "Webshop redesign",
    "Microservices decomposition",
    "Legacy system wrap",
    "Security audit & hardening",
    "ML model productization",
    "CRM integration",
    "Payment gateway integration",
    "Compliance tooling (GDPR)",
    "Search infrastructure",
    "Notification platform",
]

TASK_TITLES = [
    "Call client for kickoff",
    "Review CV shortlist",
    "Send weekly status update",
    "Prepare SoW draft",
    "Coordinate tech interview",
    "Follow up on outstanding invoice",
    "Update pipeline tracker",
    "Schedule stand-up with client",
    "Draft cost estimate",
    "Compile portfolio case study",
    "Sign NDA",
    "Verify candidate references",
    "Plan Q2 marketing brief",
    "Request new device for dev",
    "Approve timesheet",
    "Onboard new developer",
    "Collect feedback from pilot",
    "Prepare demo environment",
    "Draft proposal appendix",
    "Set up monitoring dashboard",
]

BACKLOG_IDEAS = [
    ("Auto-summarize deals with Claude", "Add a button on deal detail that produces a 3-bullet status, risk, next action."),
    ("Slack digest for BDMs", "Daily DM with overdue tasks, pipeline deltas, and hot leads."),
    ("OCR on uploaded invoices", "Extract amounts/dates and attach to deal timeline automatically."),
    ("Calendar sync with Google", "Two-way sync of calendar events with each user's Google Calendar."),
    ("Voice-note → meeting summary", "Upload a voice note, Whisper transcribes, Claude summarizes into a ClientNote."),
    ("Rate-card simulator", "Change blended rate and see projected profit across active deals live."),
    ("HR autoload candidates to deals", "When a new deal is opened, pre-fill top 5 CVs from idev-hr by tech stack match."),
    ("Inactivity reminders", "Nudge BDM if a deal hasn't moved in N days based on stage SLA."),
    ("Multi-currency pricing", "USD / EUR / AED support with daily FX from openexchangerates."),
    ("Dark-mode polish for charts", "Ensure recharts tooltips/legends read correctly in dark theme."),
    ("Email templates per stage", "Stage-specific templates accessible from deal detail."),
    ("Mobile offline mode", "Read-only cache of today's pipeline for travel."),
    ("Rich text in comments", "Markdown support + @mentions inside ClientNotes and deal notes."),
    ("Bench drag to deal", "Drag a benched person onto a deal card to assign."),
    ("Quota gauge on dashboard", "Personal + team quota vs. attainment with trend line."),
    ("Auto-tagging for clients", "Tag clients by industry/tech using website text classification."),
    ("Export to Excel", "Any list view → download .xlsx snapshot."),
    ("Two-factor auth", "TOTP for admin + manager roles."),
    ("Audit trail for edits", "Per-entity history of who changed what and when."),
    ("AI next-best-action widget", "Dashboard widget ranking 5 next actions by impact."),
]

CHAT_MESSAGES = [
    "Привет, как дела с CloudPeak?",
    "Завтра созвон с клиентом в 14:00",
    "CV отправил, жду фидбек",
    "Контракт подписан, переношу в Active",
    "Нужен ревью по цене, блендед кажется низким",
    "Напоминаю про таймшит за неделю",
    "Встреча перенесена на пятницу",
    "Новый лид пришёл через сайт — закрепил на тебя",
    "Подписали NDA, можно двигаться",
    "Клиент просит 2 Senior Python по $65/hr",
    "👍",
    "Обновил описание сделки, гляньте",
    "Fireflies транскрипт загружен в Notes",
    "Ок, делаю",
    "Где SOW лежит?",
    "В Documents на клиенте",
    "Готово, прошу ревью",
    "Смотри приложенный скриншот",
    "Клиент доволен, пилот продлили на месяц",
    "Всем привет, на этой неделе релиз",
]


def rand_choice(seq):
    return random.choice(seq)


class Command(BaseCommand):
    help = 'Bulk-generate diverse demo data across all CRM entities'

    def add_arguments(self, parser):
        parser.add_argument('--wipe', action='store_true',
                            help='Delete demo-marked data before regenerating')

    def handle(self, *args, **opts):
        random.seed(42)  # deterministic names

        from apps.clients.models import Client, Contact, ClientNote, RateCard
        from apps.deals.models import Deal, DealNote
        from apps.tasks.models import Task
        from apps.backlog.models import BacklogItem, BacklogComment
        from apps.calendar.models import CalendarEvent
        from apps.chat.models import ChatChannel, ChatMessage
        from apps.users.models import Role, Employee, SalesPlan

        try:
            admin = User.objects.get(email='demo@studio.crm')
        except User.DoesNotExist:
            admin = User.objects.filter(is_superuser=True).first()
            if not admin:
                self.stdout.write(self.style.ERROR('No admin user found. Aborting.'))
                return

        if opts['wipe']:
            self.stdout.write(self.style.WARNING('Wiping demo-marked data…'))
            Client.objects.filter(description__contains='[DEMO]').delete()
            Deal.objects.filter(description__contains='[DEMO]').delete()
            Task.objects.filter(description__contains='[DEMO]').delete()
            BacklogItem.objects.filter(description__contains='[DEMO]').delete()
            CalendarEvent.objects.filter(description__contains='[DEMO]').delete()

        # ── Users (employees) ──────────────────────────────────────────────
        sm_role, _ = Role.objects.get_or_create(
            name='Sales Manager',
            defaults={'preset': Role.Preset.SALES_MANAGER},
        )
        hr_role, _ = Role.objects.get_or_create(
            name='HR',
            defaults={'preset': Role.Preset.RECRUITER},
        )

        bulk_users: list[User] = []
        for i in range(10):
            first = rand_choice(FIRST_NAMES_RU + FIRST_NAMES_EN)
            last = rand_choice(LAST_NAMES_RU + LAST_NAMES_EN)
            email = f"demo.{first.lower()}.{last.lower()}.{i}@idev.team"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'role': sm_role if i < 7 else hr_role,
                    'is_active': True,
                },
            )
            if created:
                user.set_password('demo12345')
                user.save()
                Employee.objects.get_or_create(user=user, defaults={
                    'position': 'Sales Manager' if i < 7 else 'HR',
                    'department': 'Sales' if i < 7 else 'HR',
                })
            bulk_users.append(user)
        self.stdout.write(f'  users: +{sum(1 for u in bulk_users if u.first_name)} demo users ensured')

        all_owners = [admin] + bulk_users

        # ── Sales plans & KPI ──────────────────────────────────────────────
        this_year = date.today().year
        this_month = date.today().month
        period_start = date(this_year, this_month, 1)
        next_month_first = date(this_year, this_month + 1, 1) if this_month < 12 else date(this_year + 1, 1, 1)
        period_end = next_month_first - timedelta(days=1)
        for u in bulk_users[:7]:
            emp = Employee.objects.filter(user=u).first()
            if emp:
                SalesPlan.objects.get_or_create(
                    employee=emp,
                    period_start=period_start,
                    period_end=period_end,
                    defaults={
                        'target_amount_usd': random.choice([50000, 75000, 100000, 150000]),
                        'scope': 'personal',
                    },
                )

        try:
            from apps.kpi.models import KPITarget
            kpi_metrics = ['revenue', 'deals_won', 'calls', 'meetings', 'proposals']
            for u in bulk_users[:7]:
                for metric in kpi_metrics[:3]:
                    KPITarget.objects.get_or_create(
                        assigned_to=u,
                        metric=metric, period='month', year=this_year,
                        period_number=this_month,
                        defaults={'target_value': random.choice([10, 20, 50, 100])},
                    )
        except Exception as e:
            self.stdout.write(f'  kpi: skipped ({e})')

        # ── Clients ────────────────────────────────────────────────────────
        created_clients = []
        for i in range(30):
            name = f"{rand_choice(CLIENT_NAME_POOL)} {rand_choice(SUFFIX_POOL)}"
            c, created = Client.objects.get_or_create(
                name=name,
                defaults={
                    'industry': rand_choice(INDUSTRIES),
                    'website': f"https://{name.lower().replace(' ', '-')}.com",
                    'country': rand_choice(COUNTRIES),
                    'company_size': rand_choice(COMPANY_SIZES),
                    'status': rand_choice(CLIENT_STATUSES),
                    'tech_stack': rand_choice(TECH_STACKS),
                    'budget_range': rand_choice(BUDGETS),
                    'description': f"[DEMO] {rand_choice(['Lead from LinkedIn.', 'Referral from existing client.', 'Cold outbound contact.', 'Inbound via website form.'])}",
                    'risk_level': rand_choice(RISK_LEVELS),
                    'risk_score': random.randint(0, 100),
                    'created_by': rand_choice(all_owners),
                    'assigned_to': rand_choice(all_owners),
                },
            )
            if created:
                created_clients.append(c)
        self.stdout.write(f'  clients: +{len(created_clients)} created')

        # Contacts + notes + rate cards — backfill for any client that has none,
        # not just the ones just created this run.
        for c in Client.objects.all():
            if Contact.objects.filter(client=c).exists():
                continue
            num_contacts = random.randint(1, 3)
            for _ in range(num_contacts):
                Contact.objects.create(
                    client=c,
                    first_name=rand_choice(FIRST_NAMES_EN),
                    last_name=rand_choice(LAST_NAMES_EN),
                    email=f"{rand_choice(FIRST_NAMES_EN).lower()}@{c.website.replace('https://','')}",
                    phone=f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                    role=rand_choice(CONTACT_ROLES),
                )
            for _ in range(random.randint(0, 2)):
                ClientNote.objects.create(
                    client=c,
                    author=rand_choice(all_owners),
                    kind=rand_choice(['note', 'meeting', 'call', 'decision']),
                    body=rand_choice([
                        '[DEMO] Kick-off call went well, aligned on milestones.',
                        '[DEMO] Decision: use React + FastAPI for new module.',
                        '[DEMO] Client is evaluating three vendors; our differentiator is DevOps experience.',
                        '[DEMO] Left a voicemail, awaiting callback.',
                    ]),
                )
            for role_key, bill, cost in [('dev_senior', 70, 42), ('dev_middle', 55, 30), ('dev_junior', 40, 20), ('qa', 45, 25)]:
                RateCard.objects.get_or_create(
                    client=c, role=role_key,
                    defaults={
                        'unit': 'hourly',
                        'bill_rate_usd': bill,
                        'cost_rate_usd': cost,
                    },
                )

        # Load existing clients too for deals/tasks linkage
        all_clients = list(Client.objects.all())

        # ── Deals ──────────────────────────────────────────────────────────
        created_deals = []
        for i in range(50):
            client = rand_choice(all_clients)
            stage = rand_choice(DEAL_STAGES)
            start = date.today() - timedelta(days=random.randint(-10, 120))
            end = start + timedelta(days=random.randint(30, 365)) if stage in ('active', 'signed') else None
            d = Deal.objects.create(
                title=f"{rand_choice(DEAL_TITLES)} — {client.name}",
                client=client,
                assigned_to=rand_choice(all_owners),
                created_by=rand_choice(all_owners),
                status=stage,
                value_usd=random.choice([15000, 28500, 42000, 66000, 90000, 128000, 175000, 220000]),
                probability={'new_lead': 10, 'discovery': 25, 'proposal': 50,
                             'negotiation': 70, 'signed': 90, 'active': 95,
                             'closed': 100, 'lost': 0}.get(stage, 50),
                team_size_needed=random.randint(1, 8),
                tech_requirements=rand_choice(TECH_STACKS),
                start_date=start,
                end_date=end,
                expected_close_date=start + timedelta(days=random.randint(7, 90)),
                description=f"[DEMO] {rand_choice(['Team augmentation engagement.', 'End-to-end delivery.', 'POC with paid pilot.', 'Roadmap acceleration.'])}",
                order=i,
            )
            created_deals.append(d)
            for _ in range(random.randint(0, 3)):
                DealNote.objects.create(
                    deal=d,
                    author=rand_choice(all_owners),
                    text=rand_choice([
                        '[DEMO] Client requested CV for Senior Python next week.',
                        '[DEMO] Budget confirmed at $28k/mo for 4 seats.',
                        '[DEMO] Legal review extended by 10 days.',
                        '[DEMO] Waiting on internal approval from CFO.',
                    ]),
                )
        self.stdout.write(f'  deals: +{len(created_deals)} created')

        # ── Tasks ──────────────────────────────────────────────────────────
        existing_deals = list(Deal.objects.all())
        task_count = 0
        for i in range(80):
            deadline = timezone.now() + timedelta(days=random.randint(-14, 30))
            status = rand_choice(['todo', 'todo', 'in_progress', 'in_progress', 'done'])
            Task.objects.create(
                title=rand_choice(TASK_TITLES),
                description=f"[DEMO] Auto-generated task #{i}",
                assigned_to=rand_choice(all_owners),
                created_by=rand_choice(all_owners),
                priority=rand_choice(['low', 'medium', 'medium', 'high', 'urgent']),
                status=status,
                deadline=deadline,
                linked_client=rand_choice(all_clients) if random.random() < 0.5 else None,
                linked_deal=rand_choice(existing_deals) if random.random() < 0.35 else None,
            )
            task_count += 1
        self.stdout.write(f'  tasks: +{task_count} created')

        # ── Backlog ────────────────────────────────────────────────────────
        backlog_count = 0
        for title, desc in BACKLOG_IDEAS:
            item, created = BacklogItem.objects.get_or_create(
                title=title,
                defaults={
                    'description': f"[DEMO] {desc}",
                    'status': rand_choice(['idea', 'idea', 'idea', 'in_progress', 'testing', 'done']),
                    'priority': rand_choice(['low', 'medium', 'medium', 'high']),
                    'author': rand_choice(all_owners),
                    'votes': random.randint(0, 15),
                },
            )
            if created:
                backlog_count += 1
                for _ in range(random.randint(0, 3)):
                    BacklogComment.objects.create(
                        item=item,
                        author=rand_choice(all_owners),
                        text=rand_choice([
                            '[DEMO] Полезно, особенно для BDM команды.',
                            '[DEMO] Нужно обсудить, как это повлияет на Claude API costs.',
                            '[DEMO] +1 от меня',
                            '[DEMO] Мы обсуждали это в Q2 roadmap, давайте приоритизируем.',
                            '[DEMO] Можно сделать через существующую интеграцию.',
                        ]),
                    )
        self.stdout.write(f'  backlog: +{backlog_count} items')

        # ── Calendar events ────────────────────────────────────────────────
        ev_count = 0
        titles_meet = ["Client kickoff", "Weekly sync", "Proposal review",
                       "Tech interview", "Standup", "1-on-1",
                       "Pipeline review", "Demo for client", "Onboarding"]
        titles_reminder = ["Send status update", "Submit timesheet",
                           "Follow up on invoice", "Check referrals",
                           "Prep slides for QBR"]
        titles_busy = ["Deep work", "Out of office", "Doctor",
                       "Lunch with client", "Travel"]
        colors = ['blue', 'green', 'purple', 'orange', 'pink']
        now = timezone.now()

        for day_offset in range(-7, 21):  # ±3 weeks
            num_events = random.randint(0, 4)
            for _ in range(num_events):
                kind = random.choices(['event', 'reminder', 'busy'], weights=[6, 2, 2])[0]
                hour = random.randint(8, 20)
                minute = rand_choice([0, 15, 30, 45])
                start = (now + timedelta(days=day_offset)).replace(
                    hour=hour, minute=minute, second=0, microsecond=0
                )
                duration = rand_choice([30, 60, 60, 90, 120])
                titles_pool = {'event': titles_meet, 'reminder': titles_reminder, 'busy': titles_busy}[kind]
                CalendarEvent.objects.create(
                    title=rand_choice(titles_pool),
                    event_type=kind,
                    start_datetime=start,
                    end_datetime=start + timedelta(minutes=duration) if kind != 'reminder' else None,
                    description=f"[DEMO] Auto-generated {kind}",
                    color=rand_choice(colors),
                    created_by=rand_choice(all_owners),
                )
                ev_count += 1
        self.stdout.write(f'  calendar: +{ev_count} events')

        # ── Chat channels & messages ───────────────────────────────────────
        from apps.chat.models import ChatChannel, ChatMessage
        channels_cfg = [
            ("#general", ChatChannel.ChannelType.GROUP, all_owners),
            ("#sales", ChatChannel.ChannelType.GROUP, all_owners[:7]),
            ("#hr", ChatChannel.ChannelType.GROUP, all_owners[7:] + [admin]),
            ("#random", ChatChannel.ChannelType.GROUP, all_owners),
        ]
        msg_count = 0
        for name, ctype, members in channels_cfg:
            ch, _ = ChatChannel.objects.get_or_create(
                name=name, channel_type=ctype,
            )
            # Ensure membership
            for u in members:
                ch.members.add(u)
            for _ in range(random.randint(20, 40)):
                author = rand_choice(members)
                ChatMessage.objects.create(
                    channel=ch,
                    author=author,
                    text=rand_choice(CHAT_MESSAGES),
                )
                msg_count += 1
        self.stdout.write(f'  chat: {len(channels_cfg)} channels, +{msg_count} messages')

        # ── Summary ───────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\nDone. Current totals:'))
        self.stdout.write(f'  Users:     {User.objects.count()}')
        self.stdout.write(f'  Clients:   {Client.objects.count()}')
        self.stdout.write(f'  Contacts:  {Contact.objects.count()}')
        self.stdout.write(f'  Deals:     {Deal.objects.count()}')
        self.stdout.write(f'  Tasks:     {Task.objects.count()}')
        self.stdout.write(f'  Backlog:   {BacklogItem.objects.count()}')
        self.stdout.write(f'  Calendar:  {CalendarEvent.objects.count()}')
        self.stdout.write(f'  Chat ch:   {ChatChannel.objects.count()}')
        self.stdout.write(f'  Chat msgs: {ChatMessage.objects.count()}')
