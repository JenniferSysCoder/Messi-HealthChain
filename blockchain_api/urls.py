from django.urls import path
from .views import (
    BlockchainBlocksView, BlockchainGenesisView, BlockchainStatusView,
    LoginView, NodesView, NodeActionView, NodeDeleteView,
    PacienteHistorialView, PacientesView, PerfilView, RegistroClinicoView,
)

urlpatterns = [
    path("login/", LoginView.as_view()),
    path("perfil/", PerfilView.as_view()),
    path("blockchain/status/", BlockchainStatusView.as_view()),
    path("blockchain/genesis/", BlockchainGenesisView.as_view()),
    path("blockchain/blocks/", BlockchainBlocksView.as_view()),
    path("pacientes/", PacientesView.as_view()),
    path("pacientes/<str:paciente_id>/historial/", PacienteHistorialView.as_view()),
    path("registros/", RegistroClinicoView.as_view()),
    path("nodes/", NodesView.as_view()),
    path("nodes/<str:node_name>/<str:action>/", NodeActionView.as_view()),
    path("nodes/<str:node_name>/", NodeDeleteView.as_view()),
]
