from django.contrib import admin
from .models import CustomFieldDef, CustomFieldValue

admin.site.register(CustomFieldDef)
admin.site.register(CustomFieldValue)
