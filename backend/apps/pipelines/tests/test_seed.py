import pytest
from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline


@pytest.mark.django_db
def test_default_pipeline_seeded_for_idev():
    idev = Workspace.objects.get(slug='idev')
    p = Pipeline.objects.filter(workspace=idev, kind='deal', is_default=True).first()
    assert p is not None
    assert p.name == 'Default sales'
    codes = list(p.stages.order_by('order').values_list('code', flat=True))
    assert codes == ['new_lead', 'discovery', 'proposal', 'negotiation',
                     'signed', 'active', 'closed', 'lost']
    lost = p.stages.get(code='lost')
    assert lost.semantic == 'lost'
    won = p.stages.get(code='signed')
    assert won.semantic == 'won'
