"""
Seed command: populates the 'demo' workspace with anonymised, fictional
outstaff-themed data (IT outstaff agency, Western company names, English).

Usage:
    python manage.py seed_demo            # idempotent — skip if demo has > 5 clients
    python manage.py seed_demo --reset    # wipe demo data, then recreate
"""
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

COMPANIES = [
    ('Acme Analytics',     'Finance'),
    ('Blueprint Labs',     'IT'),
    ('Catalyst Health',    'Healthcare'),
    ('DeltaPay',           'Finance'),
    ('Everbloom Retail',   'Retail'),
    ('Foundry Robotics',   'Manufacturing'),
    ('Gridline Energy',    'Energy'),
    ('Heliograph Media',   'Media'),
    ('IonWave Security',   'Cybersecurity'),
    ('Juniper Logistics',  'Logistics'),
    ('Keystone Bio',       'Biotech'),
    ('LumenCart',          'E-commerce'),
]

LEAD_COMPANIES = [
    'NovaShift', 'Brightforge', 'KiteCraft Labs', 'Tidewave', 'Orbital Stacks',
    'Pagecrest', 'Quartz Loop', 'Rhyme Engine', 'StratusPoint', 'Twinpeak Data',
    'Umbra Systems', 'Vanguard Cell', 'Waypath', 'Xeno Metrics', 'Yonder Stack',
    'Zephyr Works', 'Arcline', 'Beacon Forge', 'Cirrus Node', 'Dimmer Optics',
    'Eventide', 'Fable Networks', 'Granite Code', 'Hearth Automation',
    'Indigo Lift', 'Javelin Flow', 'Kiln Systems', 'Lattice Pilot',
    'Moonlink', 'Northway',
]

ENG_ROLES = [
    'Senior React Developer', 'Middle Node.js Developer', 'Senior Python Engineer',
    'DevOps Engineer', 'QA Lead', 'Product Designer', 'Senior Kubernetes Engineer',
    'Full-Stack Developer', 'Mobile iOS Developer', 'Mobile Android Developer',
    'Scrum Master', 'Technical Product Manager',
]

CONTACT_POSITIONS = [
    'VP Engineering', 'CTO', 'Head of Product', 'VP Technology',
    'Engineering Manager', 'Co-Founder & CTO', 'Director of Engineering',
    'Head of Engineering', 'Chief Technology Officer', 'VP of Product',
]

DEAL_TITLES = [
    'Q2 engagement', 'Mobile rebuild', 'Backend augmentation',
    'Platform modernisation', 'DevOps ramp-up', 'Data engineering',
    'Full-stack team', 'Security audit', 'QA automation', 'AI/ML project',
    'API integration', 'Cloud migration', 'Frontend overhaul', 'Microservices refactor',
    'Infrastructure as Code', 'React Native rewrite',
]

TECH_CODES = ['react', 'nodejs', 'python', 'django', 'postgres', 'aws', 'kubernetes']

ENGAGEMENT_CODES = ['time_and_materials', 'fixed_price', 'dedicated_team']

DEAL_VALUES = [25_000, 45_000, 60_000, 95_000, 120_000, 175_000, 260_000, 340_000]

CLIENT_STATUSES = (
    ['active'] * 9 + ['lead'] * 2 + ['prospect'] * 1
)

CLIENT_COUNTRIES = ['US', 'US', 'US', 'GB', 'DE', 'NL', 'CA', 'AU', 'SG', 'FR', 'IE', 'SE']

CLIENT_SIZES = ['1-10', '11-50', '51-200', '200+']

DEAL_PIPELINE_STAGES = [
    ('new_lead',    'Новый лид',    'open', '#94A3B8', 0),
    ('discovery',   'Квалификация', 'open', '#3B82F6', 1),
    ('proposal',    'Предложение',  'open', '#8B5CF6', 2),
    ('negotiation', 'Переговоры',   'open', '#F59E0B', 3),
    ('signed',      'Подписано',    'won',  '#10B981', 4),
    ('active',      'В работе',     'won',  '#059669', 5),
    ('closed',      'Закрыто',      'won',  '#047857', 6),
    ('lost',        'Проиграно',    'lost', '#DC2626', 7),
]

LEAD_PIPELINE_STAGES = [
    ('new',         'New',           'open',      '#94A3B8', 0),
    ('in_progress', 'In Progress',   'open',      '#3B82F6', 1),
    ('qualified',   'Qualified',     'open',      '#10B981', 2),
    ('converted',   'Converted',     'converted', '#047857', 3),
    ('rejected',    'Rejected',      'lost',      '#DC2626', 4),
]

DEFAULT_SOURCES = [
    ('ads',       'Ads',          0),
    ('referral',  'Referral',     1),
    ('cold_call', 'Cold Call',    2),
    ('partner',   'Partner',      3),
    ('website',   'Website',      4),
]

DEFAULT_LOST_REASONS = [
    ('no_budget',    'No Budget',          0),
    ('competitor',   'Chose Competitor',   1),
    ('not_relevant', 'Not Relevant',       2),
    ('no_contact',   'Lost Contact',       3),
    ('other',        'Other',              4),
]


class Command(BaseCommand):
    help = "Populate the 'demo' workspace with anonymised outstaff-themed data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Wipe demo data (preserving the workspace row) and recreate.',
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        try:
            from faker import Faker
        except ImportError:
            self.stderr.write(
                "faker is not installed. Run: pip install 'faker>=20.0.0'"
            )
            return

        from apps.workspaces.models import Workspace, Membership
        from apps.pipelines.models import Pipeline, Stage, StageChange
        from apps.dictionaries.models import Source, LostReason
        from apps.custom_fields.models import CustomFieldDef, CustomFieldValue
        from apps.clients.models import Client, Contact
        from apps.deals.models import Deal, DealItem
        from apps.leads.models import Lead
        from apps.activities.models import Activity
        from django.contrib.auth import get_user_model

        User = get_user_model()
        fake = Faker('en_US')
        Faker.seed(42)
        random.seed(42)

        try:
            ws = Workspace.objects.get(slug='demo')
        except Workspace.DoesNotExist:
            ws = Workspace.objects.create(
                slug='demo',
                name='Demo',
                settings={'locale': 'en', 'currency': 'USD'},
            )

        if opts['reset']:
            self.stdout.write('Resetting demo workspace data (preserving the workspace row)…')
            Activity.objects.filter(workspace=ws).delete()
            DealItem.objects.filter(deal__workspace=ws).delete()
            StageChange.objects.filter(workspace=ws).delete()
            Lead.objects.filter(workspace=ws).delete()
            Deal.objects.filter(workspace=ws).delete()
            Contact.objects.filter(workspace=ws).delete()
            Client.objects.filter(workspace=ws).delete()
            CustomFieldValue.objects.filter(workspace=ws).delete()
            CustomFieldDef.objects.filter(workspace=ws).delete()
            Membership.objects.filter(workspace=ws).delete()
        else:
            existing = Client.objects.filter(workspace=ws).count()
            if existing > 5:
                self.stdout.write(self.style.WARNING(
                    f"demo has {existing} clients already — pass --reset to recreate."
                ))
                return

        users = self._users(User, Membership, ws)
        field_defs = self._custom_fields(CustomFieldDef, ws)
        self._ensure_dictionaries(Source, LostReason, ws)
        sources = list(Source.objects.filter(workspace=ws))
        reasons = list(LostReason.objects.filter(workspace=ws))

        deal_pipeline = self._ensure_deal_pipeline(Pipeline, Stage, ws)
        deal_stages = list(deal_pipeline.stages.order_by('order'))

        lead_pipeline = self._ensure_lead_pipeline(Pipeline, Stage, ws)
        lead_stages = list(lead_pipeline.stages.order_by('order'))

        clients = self._clients(Client, Contact, Activity, ws, users, fake)
        deals = self._deals(
            Deal, DealItem, Activity, CustomFieldValue,
            clients, deal_stages, sources, reasons,
            field_defs, ws, users, fake,
        )
        leads = self._leads(Lead, lead_stages, clients, sources, ws, users, fake)

        self.stdout.write(self.style.SUCCESS(
            f"demo populated:\n"
            f"  users: {len(users)}\n"
            f"  clients: {len(clients)}\n"
            f"  deals: {len(deals)}\n"
            f"  leads: {len(leads)}\n"
            f"  custom_fields: {len(field_defs)}"
        ))

    # ─────────────────────────────────────────────────────────────────────────
    # Users / Membership
    # ─────────────────────────────────────────────────────────────────────────

    def _users(self, User, Membership, ws):
        from apps.users.models import Role as UserRole

        admin_role = UserRole.objects.filter(preset='admin').first()

        specs = [
            ('demo@studio.crm',   'Demo',   'User',     admin_role, Membership.Role.OWNER),
            ('alex@demo.local',   'Alex',   'Thompson', admin_role, Membership.Role.ADMIN),
            ('priya@demo.local',  'Priya',  'Sharma',   None,       Membership.Role.MEMBER),
            ('marcus@demo.local', 'Marcus', 'Lee',      None,       Membership.Role.MEMBER),
            ('elena@demo.local',  'Elena',  'Volkova',  None,       Membership.Role.MEMBER),
            ('jamal@demo.local',  'Jamal',  'Ndiaye',   None,       Membership.Role.MEMBER),
        ]
        users = []
        for email, first, last, role, mem_role in specs:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'is_active': True,
                    'role': role,
                },
            )
            user.set_password('demo1234')
            user.save(update_fields=['password'])
            Membership.objects.get_or_create(
                workspace=ws,
                user=user,
                defaults={'role': mem_role},
            )
            users.append(user)
        return users

    # ─────────────────────────────────────────────────────────────────────────
    # Pipelines (ensure-or-get)
    # ─────────────────────────────────────────────────────────────────────────

    def _ensure_deal_pipeline(self, Pipeline, Stage, ws):
        pipeline, _ = Pipeline.objects.get_or_create(
            workspace=ws,
            kind='deal',
            is_default=True,
            defaults={'name': 'Default sales', 'order': 0},
        )
        for code, name, semantic, color, order in DEAL_PIPELINE_STAGES:
            Stage.objects.get_or_create(
                pipeline=pipeline,
                code=code,
                defaults={
                    'name': name,
                    'semantic': semantic,
                    'color': color,
                    'order': order,
                },
            )
        return pipeline

    def _ensure_lead_pipeline(self, Pipeline, Stage, ws):
        pipeline, _ = Pipeline.objects.get_or_create(
            workspace=ws,
            kind='lead',
            is_default=True,
            defaults={'name': 'Incoming', 'order': 0},
        )
        for code, name, semantic, color, order in LEAD_PIPELINE_STAGES:
            Stage.objects.get_or_create(
                pipeline=pipeline,
                code=code,
                defaults={
                    'name': name,
                    'semantic': semantic,
                    'color': color,
                    'order': order,
                },
            )
        return pipeline

    # ─────────────────────────────────────────────────────────────────────────
    # Dictionaries (ensure-or-get)
    # ─────────────────────────────────────────────────────────────────────────

    def _ensure_dictionaries(self, Source, LostReason, ws):
        for code, name, order in DEFAULT_SOURCES:
            Source.objects.get_or_create(
                workspace=ws, code=code,
                defaults={'name': name, 'order': order},
            )
        for code, name, order in DEFAULT_LOST_REASONS:
            LostReason.objects.get_or_create(
                workspace=ws, code=code,
                defaults={'name': name, 'order': order},
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Custom Field Definitions
    # ─────────────────────────────────────────────────────────────────────────

    def _custom_fields(self, CustomFieldDef, ws):
        from apps.custom_fields.models import FieldType

        specs = [
            {
                'code': 'team_size',
                'label': 'Team size',
                'type': FieldType.NUMBER,
                'order': 0,
                'options': [],
            },
            {
                'code': 'engagement_type',
                'label': 'Engagement type',
                'type': FieldType.ENUM,
                'order': 1,
                'options': [
                    {'code': 'time_and_materials', 'label': 'Time & Materials'},
                    {'code': 'fixed_price',         'label': 'Fixed Price'},
                    {'code': 'dedicated_team',      'label': 'Dedicated Team'},
                ],
            },
            {
                'code': 'tech_stack',
                'label': 'Tech stack',
                'type': FieldType.MULTI_ENUM,
                'order': 2,
                'options': [
                    {'code': 'react',      'label': 'React'},
                    {'code': 'nodejs',     'label': 'Node.js'},
                    {'code': 'python',     'label': 'Python'},
                    {'code': 'django',     'label': 'Django'},
                    {'code': 'postgres',   'label': 'PostgreSQL'},
                    {'code': 'aws',        'label': 'AWS'},
                    {'code': 'kubernetes', 'label': 'Kubernetes'},
                ],
            },
        ]
        fields = []
        for spec in specs:
            options = spec.pop('options')
            fd, _ = CustomFieldDef.objects.get_or_create(
                workspace=ws,
                entity='deal',
                code=spec['code'],
                defaults={
                    'label': spec['label'],
                    'type': spec['type'],
                    'order': spec['order'],
                    'options': options,
                },
            )
            fields.append(fd)
        return fields

    # ─────────────────────────────────────────────────────────────────────────
    # Clients, Contacts, Activities
    # ─────────────────────────────────────────────────────────────────────────

    def _clients(self, Client, Contact, Activity, ws, users, fake):
        statuses = list(CLIENT_STATUSES)
        random.shuffle(statuses)

        activity_types = ['note', 'call', 'meeting', 'email']
        activity_subjects = {
            'note': [
                'Internal note', 'Discussion summary', 'Agreed next steps',
                'Stakeholder feedback', 'Budget alignment note',
            ],
            'call': [
                'Intro call', 'Follow-up call', 'Contract discussion call',
                'Technical requirements call', 'Renewal conversation',
            ],
            'meeting': [
                'Kick-off meeting', 'Online presentation', 'Proposal review',
                'Team introduction', 'QBR session',
            ],
            'email': [
                'Proposal sent', 'Follow-up email', 'Contract draft shared',
                'Rate card update', 'Meeting invite sent',
            ],
        }

        clients = []
        for i, (name, industry) in enumerate(COMPANIES):
            domain = name.lower().replace(' ', '').replace('-', '') + '.com'
            status = statuses[i % len(statuses)]

            client = Client.objects.create(
                workspace=ws,
                name=name,
                industry=industry,
                country=CLIENT_COUNTRIES[i % len(CLIENT_COUNTRIES)],
                company_size=random.choice(CLIENT_SIZES),
                status=status,
                website=f'https://www.{domain}',
                tech_stack=['react', 'nodejs'],
                assigned_to=random.choice(users),
                created_by=users[0],
                description=fake.text(max_nb_chars=200),
            )
            clients.append(client)

            # 1–2 Contacts per client
            num_contacts = random.randint(1, 2)
            for j in range(num_contacts):
                first = fake.first_name()
                last = fake.last_name()
                email = f'{first.lower()}.{last.lower()}@{domain}'
                position = CONTACT_POSITIONS[j % len(CONTACT_POSITIONS)]
                Contact.objects.create(
                    client=client,
                    workspace=ws,
                    first_name=first,
                    last_name=last,
                    email=email,
                    phone=fake.phone_number()[:30],
                    position=position,
                    role='decision_maker' if j == 0 else 'other',
                    is_primary=(j == 0),
                    language_pref='en',
                    order=j,
                )

            # 3–6 Activity rows per client
            for _ in range(random.randint(3, 6)):
                act_type = random.choice(activity_types)
                Activity.objects.create(
                    workspace=ws,
                    type=act_type,
                    entity='client',
                    entity_id=client.id,
                    author=random.choice(users),
                    subject=random.choice(activity_subjects[act_type]),
                    body=fake.text(max_nb_chars=200),
                )

        return clients

    # ─────────────────────────────────────────────────────────────────────────
    # Deals, DealItems, CustomFieldValues, Activities
    # ─────────────────────────────────────────────────────────────────────────

    def _deals(
        self, Deal, DealItem, Activity, CustomFieldValue,
        clients, deal_stages, sources, reasons,
        field_defs, ws, users, fake,
    ):
        field_map = {f.code: f for f in field_defs}

        deal_activity_subjects = {
            'note': ['Deal note', 'Internal update', 'Client feedback', 'Strategy note'],
            'call': ['Discovery call', 'Negotiation call', 'Check-in call', 'Closing call'],
            'meeting': ['Proposal meeting', 'Kick-off meeting', 'Review meeting'],
            'email': ['Proposal sent', 'Rate card sent', 'Contract draft shared'],
        }

        deals = []
        # 2 deals per stage (8 stages × 2 = 16)
        for stage in deal_stages:
            for _ in range(2):
                client = random.choice(clients)
                title_prefix = random.choice(DEAL_TITLES)
                deal = Deal.objects.create(
                    workspace=ws,
                    title=f'{title_prefix} — {client.name}',
                    client=client,
                    pipeline=stage.pipeline,
                    stage=stage,
                    status='active',
                    value_usd=Decimal(str(random.choice(DEAL_VALUES))),
                    probability=random.randint(10, 90),
                    assigned_to=random.choice(users),
                    created_by=users[0],
                    source=random.choice(sources) if sources else None,
                    description=fake.text(max_nb_chars=200),
                    lost_reason=(
                        random.choice(reasons)
                        if stage.semantic == 'lost' and reasons
                        else None
                    ),
                    lost_comment=(
                        fake.sentence()
                        if stage.semantic == 'lost'
                        else ''
                    ),
                )
                deals.append(deal)

                # 1–3 DealItems
                items_total = Decimal('0')
                num_items = random.randint(1, 3)
                for item_order in range(num_items):
                    use_hourly = random.random() < 0.35
                    if use_hourly:
                        item = DealItem.objects.create(
                            deal=deal,
                            role=random.choice(ENG_ROLES),
                            rate=Decimal(str(random.randint(45, 120))),
                            rate_type='hourly',
                            quantity=1,
                            hours=random.randint(80, 400),
                            months=0,
                            order=item_order,
                        )
                    else:
                        item = DealItem.objects.create(
                            deal=deal,
                            role=random.choice(ENG_ROLES),
                            rate=Decimal(str(random.randint(4000, 9500))),
                            rate_type='monthly',
                            quantity=1,
                            months=random.randint(3, 12),
                            order=item_order,
                        )
                    items_total += item.subtotal

                # Update value_usd to reflect items total
                deal.value_usd = items_total
                deal.save(update_fields=['value_usd'])

                # Custom field values
                team_size_field = field_map.get('team_size')
                if team_size_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=team_size_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={'value_number': Decimal(str(random.randint(2, 15)))},
                    )

                eng_type_field = field_map.get('engagement_type')
                if eng_type_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=eng_type_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={'value_json': random.choice(ENGAGEMENT_CODES)},
                    )

                tech_stack_field = field_map.get('tech_stack')
                if tech_stack_field:
                    chosen = random.sample(TECH_CODES, k=random.randint(2, 4))
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=tech_stack_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={'value_json': chosen},
                    )

                # 1–3 Activity rows per deal
                for _ in range(random.randint(1, 3)):
                    act_type = random.choice(['note', 'call', 'meeting', 'email'])
                    Activity.objects.create(
                        workspace=ws,
                        type=act_type,
                        entity='deal',
                        entity_id=deal.id,
                        author=random.choice(users),
                        subject=random.choice(deal_activity_subjects[act_type]),
                        body=fake.text(max_nb_chars=200),
                    )

        return deals

    # ─────────────────────────────────────────────────────────────────────────
    # Leads
    # ─────────────────────────────────────────────────────────────────────────

    def _leads(self, Lead, lead_stages, clients, sources, ws, users, fake):
        from django.utils import timezone
        import datetime

        # Separate converted stage from the rest
        converted_stages = [s for s in lead_stages if s.semantic == 'converted']
        other_stages = [s for s in lead_stages if s.semantic != 'converted']

        leads = []
        # 20% converted = 6 out of 30
        num_converted = 6
        num_other = 24

        # Converted leads
        for _ in range(num_converted):
            stage = converted_stages[0] if converted_stages else lead_stages[-1]
            first = fake.first_name()
            last = fake.last_name()
            company_name = random.choice(LEAD_COMPANIES)
            lead = Lead.objects.create(
                workspace=ws,
                title=f'{first} {last} — {company_name}',
                first_name=first,
                last_name=last,
                phone=fake.phone_number()[:50],
                email=fake.email(),
                company_name=company_name,
                pipeline=stage.pipeline,
                stage=stage,
                source=random.choice(sources) if sources else None,
                assignee=random.choice(users),
                converted_client=random.choice(clients),
                converted_at=timezone.now() - datetime.timedelta(days=random.randint(1, 90)),
                opportunity=Decimal(str(random.randint(15_000, 250_000))),
                currency='USD',
            )
            leads.append(lead)

        # Other leads distributed across non-converted stages
        for i in range(num_other):
            stage = other_stages[i % len(other_stages)] if other_stages else lead_stages[0]
            first = fake.first_name()
            last = fake.last_name()
            company_name = random.choice(LEAD_COMPANIES)
            lead = Lead.objects.create(
                workspace=ws,
                title=f'{first} {last} — {company_name}',
                first_name=first,
                last_name=last,
                phone=fake.phone_number()[:50],
                email=fake.email(),
                company_name=company_name,
                pipeline=stage.pipeline,
                stage=stage,
                source=random.choice(sources) if sources else None,
                assignee=random.choice(users),
                converted_client=None,
                converted_at=None,
                opportunity=Decimal(str(random.randint(15_000, 250_000))),
                currency='USD',
            )
            leads.append(lead)

        return leads
