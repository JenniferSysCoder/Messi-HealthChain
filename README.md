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
Login -> autenticación JWT -> autorización por rol -> consulta de paciente -> historial -> nuevo evento clínico -> cifrado -> creación de bloque -> Proof of Work -> persistencia en `data/blockchain.json`.

La entidad emisora se obtiene del profesional autorizado y no se solicita escribir una entidad arbitraria desde el navegador.

## HTTPS
El desarrollo local de Django/Vite usa HTTP. Para la demostración del requisito HTTPS se debe ejecutar Django detrás de TLS (por ejemplo, mediante un proxy HTTPS o un certificado local). No se presenta `https://` falso sobre `runserver`.
