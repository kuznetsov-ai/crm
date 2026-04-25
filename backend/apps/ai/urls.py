from django.urls import path
from .views import (
    DealSummaryView, DraftEmailView, ChatSentimentView, LeadEnrichView,
    NextBestActionView, BenchRosterView, ResourceMatchView, CandidateMatchView,
    TranscriptProcessView, ProviderInfoView, HhSearchView, RuCompanyView,
)

urlpatterns = [
    path('provider/', ProviderInfoView.as_view(), name='ai-provider'),
    path('deals/<int:deal_id>/summary/', DealSummaryView.as_view(), name='ai-deal-summary'),
    path('deals/<int:deal_id>/draft-email/', DraftEmailView.as_view(), name='ai-draft-email'),
    path('deals/<int:deal_id>/resource-match/', ResourceMatchView.as_view(), name='ai-resource-match'),
    path('chat/<int:channel_id>/sentiment/', ChatSentimentView.as_view(), name='ai-chat-sentiment'),
    path('lead-enrich/', LeadEnrichView.as_view(), name='ai-lead-enrich'),
    path('hh-search/', HhSearchView.as_view(), name='ai-hh-search'),
    path('ru-company/', RuCompanyView.as_view(), name='ai-ru-company'),
    path('next-best-action/', NextBestActionView.as_view(), name='ai-next-best-action'),
    path('bench/', BenchRosterView.as_view(), name='ai-bench'),
    path('clients/<int:client_id>/candidate-match/', CandidateMatchView.as_view(), name='ai-candidate-match'),
    path('transcript/', TranscriptProcessView.as_view(), name='ai-transcript'),
]
