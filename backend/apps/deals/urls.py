from django.urls import path
from .views import (DealListView, DealDetailView, DealReorderView,
                    DealNoteListView, DealNoteDetailView,
                    DealDocumentListView, DealDocumentDetailView,
                    DealHistoryView,
                    DealItemListView, DealItemDetailView, DealItemReorderView)

urlpatterns = [
    path('', DealListView.as_view(), name='deal-list'),
    path('reorder/', DealReorderView.as_view(), name='deal-reorder'),
    path('<int:pk>/', DealDetailView.as_view(), name='deal-detail'),
    path('<int:pk>/history/', DealHistoryView.as_view(), name='deal-history'),
    path('<int:deal_pk>/notes/', DealNoteListView.as_view(), name='deal-note-list'),
    path('<int:deal_pk>/notes/<int:pk>/', DealNoteDetailView.as_view(), name='deal-note-detail'),
    path('<int:deal_pk>/documents/', DealDocumentListView.as_view(), name='deal-document-list'),
    path('<int:deal_pk>/documents/<int:pk>/', DealDocumentDetailView.as_view(), name='deal-document-detail'),
    path('<int:deal_pk>/items/', DealItemListView.as_view(), name='deal-item-list'),
    path('<int:deal_pk>/items/reorder/', DealItemReorderView.as_view(), name='deal-item-reorder'),
    path('<int:deal_pk>/items/<int:pk>/', DealItemDetailView.as_view(), name='deal-item-detail'),
]
