from django.urls import path
from .views import (ClientListView, ClientDetailView, ContactListView, ContactDetailView,
                    ClientDocumentListView, ClientDocumentDetailView,
                    ClientNoteListView, ClientNoteDetailView,
                    RateCardListView, RateCardDetailView,
                    ClientBulkView, ClientImportView,
                    RiskRecalcView, RiskOverrideView, TaxIdCheckView,
                    ClientSyncView)

urlpatterns = [
    path('', ClientListView.as_view(), name='client-list'),
    path('bulk/', ClientBulkView.as_view(), name='client-bulk'),
    path('import/', ClientImportView.as_view(), name='client-import'),
    path('check-tax-id/', TaxIdCheckView.as_view(), name='client-check-tax-id'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client-detail'),
    path('<int:pk>/sync/', ClientSyncView.as_view(), name='client-sync'),
    path('<int:pk>/risk/recalc/', RiskRecalcView.as_view(), name='client-risk-recalc'),
    path('<int:pk>/risk/override/', RiskOverrideView.as_view(), name='client-risk-override'),
    path('<int:client_pk>/contacts/', ContactListView.as_view(), name='contact-list'),
    path('<int:client_pk>/contacts/<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
    path('<int:client_pk>/documents/', ClientDocumentListView.as_view(), name='client-document-list'),
    path('<int:client_pk>/documents/<int:pk>/', ClientDocumentDetailView.as_view(), name='client-document-detail'),
    path('<int:client_pk>/notes/', ClientNoteListView.as_view(), name='client-note-list'),
    path('<int:client_pk>/notes/<int:pk>/', ClientNoteDetailView.as_view(), name='client-note-detail'),
    path('<int:client_pk>/rate-cards/', RateCardListView.as_view(), name='client-rate-card-list'),
    path('<int:client_pk>/rate-cards/<int:pk>/', RateCardDetailView.as_view(), name='client-rate-card-detail'),
]
