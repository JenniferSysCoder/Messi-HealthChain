from django.urls import path

from .views import (
    BlockchainBlocksView,
    BlockchainGenesisView,
    BlockchainStatusView,
    LoginView,
    PacienteHistorialView,
    PacientesView,
    RegistroClinicoView,
)

urlpatterns = [
    # ========================================================
    # AUTENTICACIÓN
    # ========================================================
    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),
    # ========================================================
    # BLOCKCHAIN
    # ========================================================
    path(
        "blockchain/status/",
        BlockchainStatusView.as_view(),
        name="blockchain-status",
    ),
    path(
        "blockchain/genesis/",
        BlockchainGenesisView.as_view(),
        name="blockchain-genesis",
    ),
    path(
        "blockchain/blocks/",
        BlockchainBlocksView.as_view(),
        name="blockchain-blocks",
    ),
    # ========================================================
    # PACIENTES
    # ========================================================
    path(
        "pacientes/",
        PacientesView.as_view(),
        name="pacientes",
    ),
    path(
        "pacientes/<str:paciente_id>/historial/",
        PacienteHistorialView.as_view(),
        name="paciente-historial",
    ),
    # ========================================================
    # REGISTROS CLÍNICOS
    # ========================================================
    path(
        "registros/",
        RegistroClinicoView.as_view(),
        name="registro-clinico",
    ),
]
