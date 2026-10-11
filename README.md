# MESSI HealthChain

Sistema académico de historia clínica portable mediante arquitectura Cliente-Servidor, API REST con Django, cliente React, cifrado y el motor Blockchain desarrollado en la primera etapa.

## Estructura principal
- `manage.py`: punto de entrada de Django.
- `config/`: configuración del servidor Django.
- `blockchain_api/`: API REST, autenticación, servicios y motor Blockchain.
- `frontend/`: aplicación React/Vite, organizada en `components/`, `pages/` y `services/`.
- `data/`: persistencia inicial mediante archivos JSON.
- `postman/`: colección para probar la API.

## Ejecución del backend
Desde la carpeta raíz del proyecto:
```bash
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

## Ejecución del frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Abrir la URL mostrada por Vite.

## Credenciales de demostración
- Profesional: `dr.messi` / `Medico123!`
- Paciente: `paciente.demo` / `Paciente123!`
- Administrador: `admin` / `Admin123!`

## Flujo
El registro de una atención valida las credenciales JVPM/JVPP/JVPO/JVPE en Django, cifra los datos clínicos y crea un bloque con Proof of Work. Cada nodo persiste sus bloques cifrados en `data/nodes/<NODO>/blocks/`. Los nodos activos intercambian bloques por TCP y consultan periódicamente la cadena completa de sus pares; al sincronizar solo aceptan cadenas con la dificultad, los hashes y los enlaces válidos. El historial clínico descifrado sigue requiriendo autorización del backend.

La entidad emisora se obtiene del profesional autorizado y no se solicita escribir una entidad arbitraria desde el navegador.

## Verificación
Desde la raíz del proyecto en PowerShell:
```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test blockchain_api.tests
Set-Location .\frontend
npm run build
```

La prueba `test_mined_blocks_are_broadcast_between_independent_tcp_nodes` levanta dos servidores TCP locales y verifica que ambos almacenen el mismo Genesis y el bloque minado. La prueba `test_node_sync_replaces_a_shorter_chain_with_a_valid_peer_chain` valida la recuperación de una cadena atrasada.

## HTTPS
El desarrollo local de Django/Vite usa HTTP. Para la demostración del requisito HTTPS se debe ejecutar Django detrás de TLS (por ejemplo, mediante un proxy HTTPS o un certificado local). No se presenta `https://` falso sobre `runserver`.
