from rest_framework.routers import DefaultRouter
from .views import PipelineViewSet, StageViewSet

router = DefaultRouter()
router.register(r'pipelines', PipelineViewSet, basename='pipelines')
router.register(r'stages', StageViewSet, basename='stages')

urlpatterns = router.urls
