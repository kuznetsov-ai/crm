from rest_framework.routers import DefaultRouter
from .views import CustomFieldDefViewSet

router = DefaultRouter()
router.register(r'custom-fields/defs', CustomFieldDefViewSet, basename='custom-field-defs')

urlpatterns = router.urls
