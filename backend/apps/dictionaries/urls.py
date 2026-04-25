from rest_framework.routers import DefaultRouter
from .views import SourceViewSet, LostReasonViewSet

router = DefaultRouter()
router.register(r'sources', SourceViewSet, basename='sources')
router.register(r'lost-reasons', LostReasonViewSet, basename='lost-reasons')

urlpatterns = router.urls
