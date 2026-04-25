from django.urls import path
from .views import BacklogListView, BacklogDetailView, BacklogVoteView, BacklogCommentListView

urlpatterns = [
    path('', BacklogListView.as_view()),
    path('<int:pk>/', BacklogDetailView.as_view()),
    path('<int:pk>/vote/', BacklogVoteView.as_view()),
    path('<int:item_pk>/comments/', BacklogCommentListView.as_view()),
]
