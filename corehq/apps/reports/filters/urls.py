from django.conf.urls.defaults import *

from . import api

urlpatterns = patterns('',
    url(r'^emwf_options/$', api.EmwfOptionsView.as_view(), name='emwf_options'),
    url(r'^emwf_options/(?P<all_data>all-data)/$', api.EmwfOptionsView.as_view(), name='emwf_options_with_all_data'),
)
