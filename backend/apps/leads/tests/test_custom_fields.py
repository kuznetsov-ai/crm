import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.leads.models import Lead
from apps.custom_fields.models import CustomFieldDef, Entity, FieldType

User = get_user_model()


@pytest.fixture
def setup(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='cf_lead_tester@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    lead = Lead.objects.create(
        title='CF Test Lead', workspace=idev, assignee=u,
    )
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev, lead


@pytest.mark.django_db
def test_lead_detail_has_custom_fields(setup):
    c, idev, lead = setup
    resp = c.get(f'/api/leads/{lead.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert 'custom_fields' in resp.data
    assert isinstance(resp.data['custom_fields'], dict)


@pytest.mark.django_db
def test_lead_patch_custom_fields(setup):
    c, idev, lead = setup
    CustomFieldDef.objects.create(
        workspace=idev, entity=Entity.LEAD, code='source_detail', label='Source Detail',
        type=FieldType.STRING,
    )
    resp = c.patch(
        f'/api/leads/{lead.pk}/',
        {'custom_fields': {'source_detail': 'LinkedIn cold outreach'}},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 200
    assert resp.data['custom_fields']['source_detail'] == 'LinkedIn cold outreach'
