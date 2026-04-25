"""
Seed command: creates 'Академия ТСЖ (demo)' workspace with realistic ТСЖ data.

Usage:
    python manage.py seed_bitrix_demo            # idempotent — skip if exists
    python manage.py seed_bitrix_demo --reset    # delete and recreate
"""
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

TSZH_NAMES = [
    'ТСЖ Ромашка', 'ЖК Парковая', 'ТСЖ Семейный', 'УК Содружество',
    'ТСЖ Лазурный берег', 'ЖК Весна-6', 'ТСЖ Северное сияние', 'УК Дом-мой',
    'ТСЖ Горизонт', 'ТСЖ Восход', 'ЖК Московский-12', 'ТСЖ Солнечный',
    'УК Престиж', 'ТСЖ Заря', 'ЖК Центральный',
]

DEAL_PIPELINES = [
    {
        'name': 'Основная',
        'is_default': True,
        'stages': [
            ('new',          'Новая',         'open'),
            ('qualify',      'Квалификация',  'open'),
            ('commercial',   'Коммерческое',  'open'),
            ('negotiation',  'Переговоры',    'open'),
            ('contract',     'Договор',       'open'),
            ('won',          'Выиграна',      'won'),
            ('lost',         'Проиграна',     'lost'),
            ('deferred',     'Отложена',      'open'),
        ],
    },
    {
        'name': 'Холодная база',
        'stages': [
            ('new',          'Новая',             'open'),
            ('first_call',   'Первый звонок',     'open'),
            ('interest',     'Интерес',           'open'),
            ('callback',     'Перезвонить',       'open'),
            ('meeting',      'Встреча назначена', 'open'),
            ('won',          'Подписан',          'won'),
            ('lost',         'Отказ',             'lost'),
        ],
    },
    {
        'name': 'Агенты — Агентское вознаграждение',
        'stages': [
            ('new',          'Новая',             'open'),
            ('contact',      'Контакт',           'open'),
            ('docs',         'Документы',         'open'),
            ('review',       'Проверка',          'open'),
            ('approval',     'Согласование',      'open'),
            ('payment',      'Оплата',            'open'),
            ('paid',         'Выплачено',         'won'),
            ('dispute',      'Спор',              'open'),
            ('lost',         'Отказ',             'lost'),
        ],
    },
    {
        'name': 'Клиенты — Агентское вознаграждение',
        'stages': [
            ('new',          'Новая',             'open'),
            ('proposal',     'КП отправлено',     'open'),
            ('review',       'На рассмотрении',   'open'),
            ('negotiation',  'Переговоры',        'open'),
            ('signed',       'Договор подписан',  'open'),
            ('won',          'Выиграна',          'won'),
            ('lost',         'Проиграна',         'lost'),
        ],
    },
    {
        'name': 'Холод — лидорубы Кирилл',
        'stages': [
            ('new',          'Новый',             'open'),
            ('dialing',      'Дозваниваемся',     'open'),
            ('reached',      'Дозвонились',       'open'),
            ('interest',     'Интерес',           'open'),
            ('transferred',  'Передан менеджеру', 'open'),
            ('won',          'Конвертирован',     'won'),
            ('lost',         'Отказ',             'lost'),
        ],
    },
    {
        'name': 'Холод — лидорубы Данила',
        'stages': [
            ('new',          'Новый',             'open'),
            ('dialing',      'Дозваниваемся',     'open'),
            ('reached',      'Дозвонились',       'open'),
            ('interest',     'Интерес',           'open'),
            ('transferred',  'Передан менеджеру', 'open'),
            ('won',          'Конвертирован',     'won'),
            ('lost',         'Отказ',             'lost'),
        ],
    },
    {
        'name': 'Партнёры ООО "Академия ТСЖ"',
        'stages': [
            ('new',          'Новый',             'open'),
            ('intro',        'Знакомство',        'open'),
            ('proposal',     'Предложение',       'open'),
            ('negotiation',  'Переговоры',        'open'),
            ('contract',     'Договор',           'open'),
            ('active',       'Активный',          'open'),
            ('won',          'Партнёр',           'won'),
            ('lost',         'Отказ',             'lost'),
        ],
    },
]

LEAD_PIPELINE = {
    'name': 'Входящие',
    'stages': [
        ('new',         'Новый',         'open'),
        ('in_progress', 'В работе',      'open'),
        ('qualified',   'Квалифицирован','open'),
        ('converted',   'Конвертирован', 'converted'),
        ('lost',        'Отказ',         'lost'),
    ],
}

DEFAULT_SOURCES = [
    ('website',   'Сайт',         0),
    ('referral',  'Рекомендация', 1),
    ('cold_call', 'Холодный звонок', 2),
    ('ad',        'Реклама',      3),
    ('partner',   'Партнёр',      4),
]

DEFAULT_LOST_REASONS = [
    ('price',       'Цена',              0),
    ('competitor',  'Ушёл к конкуренту', 1),
    ('no_budget',   'Нет бюджета',       2),
    ('no_need',     'Нет потребности',   3),
    ('no_contact',  'Нет контакта',      4),
]


class Command(BaseCommand):
    help = "Seed an 'Академия ТСЖ (demo)' workspace with realistic data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Drop the workspace if it exists before creating.',
        )

    def handle(self, *args, **options):
        try:
            from faker import Faker
        except ImportError:
            self.stderr.write(
                "faker is not installed. Run: pip install 'faker>=20.0.0'"
            )
            return

        from apps.workspaces.models import Workspace, Membership
        from django.contrib.auth import get_user_model
        from apps.pipelines.models import Pipeline, Stage
        from apps.dictionaries.models import Source, LostReason
        from apps.custom_fields.models import CustomFieldDef
        from apps.clients.models import Client, Contact
        from apps.deals.models import Deal, DealItem
        from apps.leads.models import Lead
        from apps.activities.models import Activity

        User = get_user_model()
        reset = options['reset']

        fake = Faker('ru_RU')
        Faker.seed(42)
        random.seed(42)

        existing = Workspace.objects.filter(slug='academy-tsg').first()
        if existing:
            if not reset:
                self.stdout.write(self.style.WARNING(
                    "Workspace 'academy-tsg' already exists. Pass --reset to recreate."
                ))
                return
            self.stdout.write('Resetting existing workspace…')
            # StageChange.to_stage is PROTECT — must delete manually first
            from apps.pipelines.models import StageChange
            StageChange.objects.filter(workspace=existing).delete()
            existing.delete()

        with transaction.atomic():
            ws = self._create_workspace(Workspace)
            users = self._create_users(User, Membership, ws)

            pipelines = self._create_deal_pipelines(Pipeline, Stage, ws)
            lead_pipeline = self._create_lead_pipeline(Pipeline, Stage, ws)

            self._create_dictionaries(Source, LostReason, ws)

            deal_fields = self._create_deal_custom_fields(CustomFieldDef, ws)
            self._create_lead_custom_fields(CustomFieldDef, ws)

            clients = self._create_clients(Client, Contact, Activity, ws, users, fake)
            deals = self._create_deals(Deal, DealItem, pipelines, clients, ws, users, fake)
            self._attach_deal_custom_fields(deal_fields, deals, ws, fake)
            leads = self._create_leads(Lead, lead_pipeline, ws, fake, users, clients)

        self.stdout.write(self.style.SUCCESS(
            f"Created workspace 'academy-tsg' (id={ws.id}):\n"
            f"  users: {len(users)}\n"
            f"  pipelines (deal): {len(pipelines)}\n"
            f"  clients: {len(clients)}\n"
            f"  deals: {len(deals)}\n"
            f"  leads: {len(leads)}"
        ))

    # ─────────────────────────────────────────────────────────────────────────
    # Workspace
    # ─────────────────────────────────────────────────────────────────────────

    def _create_workspace(self, Workspace):
        ws = Workspace.objects.create(
            slug='academy-tsg',
            name='Академия ТСЖ (demo)',
            settings={
                'locale': 'ru',
                'currency': 'RUB',
                'brand_color': '#0ea5e9',
            },
        )
        return ws

    # ─────────────────────────────────────────────────────────────────────────
    # Users
    # ─────────────────────────────────────────────────────────────────────────

    def _create_users(self, User, Membership, ws):
        demo_users = [
            ('owner@academy-tsg.local',      Membership.Role.OWNER),
            ('manager@academy-tsg.local',    Membership.Role.MEMBER),
            ('accountant@academy-tsg.local', Membership.Role.MEMBER),
        ]
        users = []
        for email, role in demo_users:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={'is_active': True},
            )
            user.set_password('demo1234')
            user.save(update_fields=['password'])
            Membership.objects.get_or_create(
                workspace=ws,
                user=user,
                defaults={'role': role},
            )
            users.append(user)
        return users

    # ─────────────────────────────────────────────────────────────────────────
    # Pipelines
    # ─────────────────────────────────────────────────────────────────────────

    def _create_deal_pipelines(self, Pipeline, Stage, ws):
        pipelines = []
        for order, spec in enumerate(DEAL_PIPELINES):
            pipeline, _ = Pipeline.objects.get_or_create(
                workspace=ws,
                kind=Pipeline.Kind.DEAL,
                name=spec['name'],
                defaults={
                    'is_default': spec.get('is_default', False),
                    'order': order,
                },
            )
            for stage_order, (code, name, semantic) in enumerate(spec['stages']):
                Stage.objects.get_or_create(
                    pipeline=pipeline,
                    code=code,
                    defaults={
                        'name': name,
                        'semantic': semantic,
                        'order': stage_order,
                    },
                )
            pipelines.append(pipeline)
        return pipelines

    def _create_lead_pipeline(self, Pipeline, Stage, ws):
        spec = LEAD_PIPELINE
        pipeline, _ = Pipeline.objects.get_or_create(
            workspace=ws,
            kind=Pipeline.Kind.LEAD,
            name=spec['name'],
            defaults={'is_default': True, 'order': 0},
        )
        for order, (code, name, semantic) in enumerate(spec['stages']):
            Stage.objects.get_or_create(
                pipeline=pipeline,
                code=code,
                defaults={
                    'name': name,
                    'semantic': semantic,
                    'order': order,
                },
            )
        return pipeline

    # ─────────────────────────────────────────────────────────────────────────
    # Dictionaries
    # ─────────────────────────────────────────────────────────────────────────

    def _create_dictionaries(self, Source, LostReason, ws):
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
    # Custom Fields
    # ─────────────────────────────────────────────────────────────────────────

    def _create_deal_custom_fields(self, CustomFieldDef, ws):
        from apps.custom_fields.models import FieldType
        specs = [
            {
                'code': 'inn',
                'label': 'ИНН',
                'type': FieldType.STRING,
                'required': True,
                'order': 0,
            },
            {
                'code': 'inn_chairman',
                'label': 'ИНН Председателя',
                'type': FieldType.STRING,
                'required': False,
                'order': 1,
            },
            {
                'code': 'accounting_method',
                'label': 'Как ведётся бух. учёт',
                'type': FieldType.ENUM,
                'required': False,
                'order': 2,
                'options': [
                    {'code': 'own',        'label': 'Собственный'},
                    {'code': 'outsourced', 'label': 'Аутсорс'},
                    {'code': 'bx_gos',    'label': 'Гос. система'},
                ],
            },
            {
                'code': 'accounting_cost',
                'label': 'Стоимость бух. учёта (руб./мес)',
                'type': FieldType.NUMBER,
                'required': False,
                'order': 3,
            },
            {
                'code': 'chairman_registration_date',
                'label': 'Дата регистрации председателя (текст)',
                'type': FieldType.STRING,
                'required': False,
                'order': 4,
            },
        ]
        fields = []
        for spec in specs:
            options = spec.pop('options', [])
            required = spec.pop('required', False)
            fd, _ = CustomFieldDef.objects.get_or_create(
                workspace=ws,
                entity='deal',
                code=spec['code'],
                defaults={
                    'label': spec['label'],
                    'type': spec['type'],
                    'required': required,
                    'order': spec['order'],
                    'options': options,
                },
            )
            fields.append(fd)
        return fields

    def _create_lead_custom_fields(self, CustomFieldDef, ws):
        from apps.custom_fields.models import FieldType
        specs = [
            {'code': 'inn',         'label': 'ИНН',         'type': FieldType.STRING, 'order': 0},
            {'code': 'region_code', 'label': 'Код региона', 'type': FieldType.STRING, 'order': 1},
        ]
        for spec in specs:
            CustomFieldDef.objects.get_or_create(
                workspace=ws,
                entity='lead',
                code=spec['code'],
                defaults={
                    'label': spec['label'],
                    'type': spec['type'],
                    'order': spec['order'],
                },
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Clients & Contacts & Activities
    # ─────────────────────────────────────────────────────────────────────────

    def _rand_tax_id(self):
        """10 or 12 digit ИНН (10 for legal entity, 12 for individual)."""
        length = random.choice([10, 12])
        # Ensure first digit is not 0
        first = str(random.randint(1, 9))
        rest = ''.join([str(random.randint(0, 9)) for _ in range(length - 1)])
        return first + rest

    def _create_clients(self, Client, Contact, Activity, ws, users, fake):
        clients = []
        statuses = ['active', 'active', 'active', 'prospect', 'paused']
        company_sizes = ['1-10', '11-50', '51-200']

        for i, name in enumerate(TSZH_NAMES):
            tax_id = self._rand_tax_id()
            # ensure uniqueness per (country, tax_id)
            while Client.objects.filter(tax_id=tax_id, tax_id_country='RU').exists():
                tax_id = self._rand_tax_id()

            client = Client.objects.create(
                workspace=ws,
                name=name,
                industry='Real estate',
                country='RU',
                tax_id=tax_id,
                tax_id_country='RU',
                status=random.choice(statuses),
                company_size=random.choice(company_sizes),
                assigned_to=random.choice(users),
                created_by=users[0],
                description=fake.text(max_nb_chars=200),
            )
            clients.append(client)

            # 1-2 Contacts per client
            num_contacts = random.randint(1, 2)
            for j in range(num_contacts):
                first_name = fake.first_name()
                last_name = fake.last_name()
                position = 'Председатель ТСЖ' if j == 0 else 'Бухгалтер'
                role = 'decision_maker' if j == 0 else 'other'
                Contact.objects.create(
                    client=client,
                    workspace=ws,
                    first_name=first_name,
                    last_name=last_name,
                    email=fake.email(),
                    phone=fake.phone_number()[:30],
                    position=position,
                    role=role,
                    is_primary=(j == 0),
                    language_pref='ru',
                    order=j,
                )

            # 2-5 Activity rows per client
            activity_types = ['note', 'call', 'meeting']
            subjects_by_type = {
                'note': [
                    'Внутренняя заметка',
                    'Обсуждение условий',
                    'Зафиксированы договорённости',
                ],
                'call': [
                    'Исходящий звонок',
                    'Входящий звонок',
                    'Повторный звонок по договору',
                ],
                'meeting': [
                    'Встреча с председателем',
                    'Онлайн-презентация',
                    'Согласование договора',
                ],
            }
            for _ in range(random.randint(2, 5)):
                act_type = random.choice(activity_types)
                Activity.objects.create(
                    workspace=ws,
                    type=act_type,
                    entity='client',
                    entity_id=client.id,
                    author=random.choice(users),
                    subject=random.choice(subjects_by_type[act_type]),
                    body=fake.text(max_nb_chars=150),
                )

        return clients

    # ─────────────────────────────────────────────────────────────────────────
    # Deals
    # ─────────────────────────────────────────────────────────────────────────

    def _create_deals(self, Deal, DealItem, pipelines, clients, ws, users, fake):
        from apps.dictionaries.models import LostReason
        from apps.pipelines.models import Stage

        lost_reasons = list(LostReason.objects.filter(workspace=ws))
        deals = []

        # Distribute deals across all 8 Deal.Status codes for a realistic funnel
        deal_statuses = [
            'new_lead', 'new_lead',
            'discovery', 'discovery', 'discovery',
            'proposal', 'proposal', 'proposal', 'proposal',
            'negotiation', 'negotiation', 'negotiation',
            'signed', 'signed', 'signed',
            'active', 'active', 'active',
            'closed', 'closed',
            'lost', 'lost',
        ]
        status_index = 0

        for pipeline in pipelines:
            stages = list(Stage.objects.filter(pipeline=pipeline))
            num_deals = random.randint(2, 4)

            for i in range(num_deals):
                stage = random.choice(stages)
                client = random.choice(clients)
                value = Decimal(str(random.randint(30_000, 300_000)))

                # Cycle through deal statuses for a non-trivial funnel
                deal_status = deal_statuses[status_index % len(deal_statuses)]
                status_index += 1

                deal = Deal.objects.create(
                    workspace=ws,
                    title=f'{client.name} — {pipeline.name}',
                    client=client,
                    pipeline=pipeline,
                    stage=stage,
                    status=deal_status,
                    value_usd=value,
                    probability=random.randint(10, 90),
                    assigned_to=random.choice(users),
                    created_by=users[0],
                    description=fake.text(max_nb_chars=200),
                    lost_reason=(
                        random.choice(lost_reasons)
                        if (stage.semantic == 'lost' or deal_status == 'lost') and lost_reasons
                        else None
                    ),
                    lost_comment=(
                        fake.sentence()
                        if stage.semantic == 'lost' or deal_status == 'lost'
                        else ''
                    ),
                )
                deals.append(deal)

                # 1-3 DealItems
                items_total = Decimal('0')
                num_items = random.randint(1, 3)
                roles = [
                    'Ведение бух. учёта',
                    'Сдача отчётности',
                    'Расчёт зарплаты',
                    'Кадровый учёт',
                    'Консультации',
                ]
                for item_order in range(num_items):
                    rate = Decimal(str(random.randint(10_000, 30_000)))
                    months = random.randint(6, 24)
                    item = DealItem.objects.create(
                        deal=deal,
                        role=random.choice(roles),
                        rate=rate,
                        rate_type='monthly',
                        quantity=1,
                        months=months,
                        order=item_order,
                    )
                    items_total += item.subtotal

                # Update deal value_usd to reflect items total
                deal.value_usd = items_total
                deal.save(update_fields=['value_usd'])

        return deals

    # ─────────────────────────────────────────────────────────────────────────
    # Deal Custom Field Values
    # ─────────────────────────────────────────────────────────────────────────

    def _attach_deal_custom_fields(self, deal_fields, deals, ws, fake):
        from apps.custom_fields.models import CustomFieldValue
        # Map code -> field object
        field_map = {f.code: f for f in deal_fields}
        accounting_methods = ['own', 'outsourced', 'bx_gos']

        for deal in deals:
            # inn — always
            inn_field = field_map.get('inn')
            if inn_field:
                inn_val = self._rand_tax_id()
                CustomFieldValue.objects.get_or_create(
                    workspace=ws,
                    field=inn_field,
                    entity='deal',
                    entity_id=deal.id,
                    defaults={'value_text': inn_val},
                )

            # inn_chairman — ~70%
            if random.random() < 0.7:
                inn_ch_field = field_map.get('inn_chairman')
                if inn_ch_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=inn_ch_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={'value_text': self._rand_tax_id()},
                    )

            # accounting_method — always
            am_field = field_map.get('accounting_method')
            if am_field:
                CustomFieldValue.objects.get_or_create(
                    workspace=ws,
                    field=am_field,
                    entity='deal',
                    entity_id=deal.id,
                    defaults={'value_json': random.choice(accounting_methods)},
                )

            # accounting_cost — ~80%
            if random.random() < 0.8:
                ac_field = field_map.get('accounting_cost')
                if ac_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=ac_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={
                            'value_number': Decimal(str(random.randint(5_000, 50_000)))
                        },
                    )

            # chairman_registration_date — ~50%
            if random.random() < 0.5:
                crd_field = field_map.get('chairman_registration_date')
                if crd_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=crd_field,
                        entity='deal',
                        entity_id=deal.id,
                        defaults={
                            'value_text': fake.date_of_birth(
                                minimum_age=1, maximum_age=10
                            ).strftime('%d.%m.%Y')
                        },
                    )

    # ─────────────────────────────────────────────────────────────────────────
    # Leads
    # ─────────────────────────────────────────────────────────────────────────

    def _create_leads(self, Lead, lead_pipeline, ws, fake, users, clients):
        from apps.custom_fields.models import CustomFieldDef, CustomFieldValue
        from apps.dictionaries.models import Source
        from apps.pipelines.models import Stage
        from django.utils import timezone
        import datetime

        stages = list(Stage.objects.filter(pipeline=lead_pipeline))
        sources = list(Source.objects.filter(workspace=ws))

        # Get lead custom fields
        inn_field = CustomFieldDef.objects.filter(
            workspace=ws, entity='lead', code='inn'
        ).first()
        region_field = CustomFieldDef.objects.filter(
            workspace=ws, entity='lead', code='region_code'
        ).first()

        # Random ТСЖ-style company names for leads (not converted to clients yet)
        lead_company_prefixes = [
            'ТСЖ', 'ЖК', 'УК', 'МКД', 'ТСН', 'ЖСК',
        ]
        lead_company_suffixes = [
            'Надежда', 'Рассвет', 'Берёзка', 'Олимп', 'Уют',
            'Радуга', 'Сосновый бор', 'Мечта', 'Прибой', 'Факел',
            'Перспектива', 'Согласие', 'Дружба', 'Звезда', 'Феникс',
        ]

        region_codes = ['77', '78', '50', '23', '61', '66', '52', '74', '54', '16']

        leads = []
        for i in range(50):
            first_name = fake.first_name()
            last_name = fake.last_name()
            stage = random.choice(stages)
            company_name = (
                random.choice(lead_company_prefixes) + ' ' +
                random.choice(lead_company_suffixes)
            )
            source = random.choice(sources) if sources else None
            assignee = random.choice(users)

            # ~30% have converted_at + converted_client
            is_converted = (
                stage.semantic == 'converted' or
                (random.random() < 0.3 and stage.semantic not in ('lost',))
            )
            converted_client = random.choice(clients) if is_converted else None
            converted_at = None
            if is_converted:
                converted_at = timezone.now() - datetime.timedelta(days=random.randint(1, 90))

            lead = Lead.objects.create(
                workspace=ws,
                title=f'{last_name} {first_name} — {company_name}',
                first_name=first_name,
                last_name=last_name,
                phone=fake.phone_number()[:50],
                email=fake.email(),
                company_name=company_name,
                pipeline=lead_pipeline,
                stage=stage,
                source=source,
                assignee=assignee,
                converted_client=converted_client,
                converted_at=converted_at,
                opportunity=Decimal(str(random.randint(5_000, 100_000))),
                currency='RUB',
                lost_reason=None,
            )
            leads.append(lead)

            # Custom fields: inn + region_code for ~60%
            if random.random() < 0.6:
                if inn_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=inn_field,
                        entity='lead',
                        entity_id=lead.id,
                        defaults={'value_text': self._rand_tax_id()},
                    )
                if region_field:
                    CustomFieldValue.objects.get_or_create(
                        workspace=ws,
                        field=region_field,
                        entity='lead',
                        entity_id=lead.id,
                        defaults={'value_text': random.choice(region_codes)},
                    )

        return leads
