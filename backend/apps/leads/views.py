from rest_framework import viewsets, status as drf_status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction

from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Lead
from .serializers import LeadSerializer


class LeadViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Lead.objects.select_related(
        'pipeline', 'stage', 'source', 'lost_reason', 'assignee',
        'converted_client', 'converted_deal',
    ).all()
    serializer_class = LeadSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['pipeline', 'stage', 'source', 'assignee']
    search_fields = ['title', 'company_name', 'email', 'phone']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def kanban(self, request):
        pipeline_id = request.query_params.get('pipeline_id')
        qs = self.get_queryset().select_related('stage')
        if pipeline_id:
            qs = qs.filter(pipeline_id=pipeline_id)
        else:
            from apps.pipelines.models import Pipeline
            p = Pipeline.objects.filter(
                workspace=request.workspace, kind='lead', is_default=True
            ).first()
            if p:
                qs = qs.filter(pipeline=p)

        groups = {}
        for lead in qs:
            groups.setdefault(lead.stage_id, []).append(
                LeadSerializer(lead, context={'request': request}).data
            )
        return Response(groups)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        from apps.pipelines.models import StageChange
        from apps.pipelines.serializers import StageChangeSerializer
        self.get_object()  # enforce workspace scope + 404
        qs = StageChange.objects.filter(entity_type='lead', entity_id=pk).order_by('-at')
        return Response(StageChangeSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def convert(self, request, pk=None):
        from apps.clients.models import Client, Contact
        from apps.deals.models import Deal
        from apps.pipelines.models import Pipeline, Stage
        from django.utils import timezone

        lead = self.get_object()

        # 409 if already converted
        if lead.converted_at is not None:
            return Response({
                'detail': 'Already converted.',
                'lead': LeadSerializer(lead, context={'request': request}).data,
                'client_id': lead.converted_client_id,
                'deal_id': lead.converted_deal_id,
            }, status=drf_status.HTTP_409_CONFLICT)

        body = request.data
        create_client = body.get('create_client', True)
        client_id = body.get('client_id')
        create_contact = body.get('create_contact', True)
        create_deal = body.get('create_deal', True)
        deal_pipeline_id = body.get('deal_pipeline_id')
        deal_stage_id = body.get('deal_stage_id')

        # 1. Resolve/create Client
        if client_id:
            client = Client.objects.filter(id=client_id, workspace=request.workspace).first()
            if not client:
                return Response({'detail': 'client_id not found in workspace'}, status=400)
        elif create_client:
            client = Client.objects.create(
                name=lead.company_name or lead.title,
                tax_id=lead.tax_id or '',
                website=lead.website or '',
                workspace=request.workspace,
            )
        else:
            return Response({'detail': 'client_id or create_client required'}, status=400)

        # 2. Create Contact
        contact = None
        if create_contact and (lead.first_name or lead.last_name or lead.phone or lead.email):
            contact = Contact.objects.create(
                client=client,
                first_name=lead.first_name or '',
                last_name=lead.last_name or '',
                phone=lead.phone or '',
                email=lead.email or '',
                workspace=request.workspace,
            )

        # 3. Create Deal
        deal = None
        if create_deal:
            if deal_pipeline_id:
                deal_pipeline = Pipeline.objects.filter(
                    id=deal_pipeline_id, workspace=request.workspace, kind='deal'
                ).first()
            else:
                deal_pipeline = Pipeline.objects.filter(
                    workspace=request.workspace, kind='deal', is_default=True
                ).first()
            if not deal_pipeline:
                return Response({'detail': 'no deal pipeline available'}, status=400)

            deal_stage = None
            if deal_stage_id:
                deal_stage = Stage.objects.filter(
                    id=deal_stage_id, pipeline=deal_pipeline
                ).first()
            if not deal_stage:
                deal_stage = deal_pipeline.stages.order_by('order').first()

            deal = Deal.objects.create(
                title=lead.title or f'Deal from {lead.company_name or "lead"}',
                client=client,
                workspace=request.workspace,
                pipeline=deal_pipeline,
                stage=deal_stage,
                value_usd=lead.opportunity or 0,
            )

        # 4. Move lead to converted stage
        conv_stage = Stage.objects.filter(
            pipeline=lead.pipeline, semantic='converted'
        ).first()
        if conv_stage:
            lead.stage = conv_stage
        lead.converted_client = client
        lead.converted_deal = deal
        lead.converted_at = timezone.now()
        lead.save()

        return Response({
            'lead': LeadSerializer(lead, context={'request': request}).data,
            'client_id': client.id,
            'contact_id': contact.id if contact else None,
            'deal_id': deal.id if deal else None,
        }, status=drf_status.HTTP_200_OK)
