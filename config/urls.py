from django.urls import include, path

urlpatterns = [
    path("api/", include("blockchain_api.urls")),
]
