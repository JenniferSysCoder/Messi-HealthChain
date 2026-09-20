const API_URL =
    "http://127.0.0.1:8000/api";


async function request(
    endpoint,
    options = {}
) {

    const token =
        localStorage.getItem(
            "healthchain_token"
        );

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        const message =
            data?.message ||
            data?.detail ||
            `Error HTTP ${response.status}`;

        throw new Error(message);
    }

    return data;
}


// ============================================================
// LOGIN
// ============================================================

export async function login(
    username,
    password
) {

    const response =
        await request(
            "/login/",
            {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

    localStorage.setItem(
        "healthchain_token",
        response.token
    );

    localStorage.setItem(
        "healthchain_user",
        JSON.stringify(
            response.usuario
        )
    );

    return response;
}


// ============================================================
// USUARIO ACTUAL
// ============================================================

export async function getMe() {

    const user =
        localStorage.getItem(
            "healthchain_user"
        );

    if (!user) {
        return null;
    }

    try {

        return JSON.parse(user);

    } catch {

        return null;
    }
}


// ============================================================
// LOGOUT
// ============================================================

export function logout() {

    localStorage.removeItem(
        "healthchain_token"
    );

    localStorage.removeItem(
        "healthchain_user"
    );
}


// ============================================================
// PERFIL
// ============================================================

export async function getProfile() {

    return request(
        "/perfil/"
    );
}


// ============================================================
// PACIENTES
// ============================================================

export async function getPatients() {
    const response = await request("/pacientes/");

    return response.pacientes || [];
}


// ============================================================
// HISTORIAL DE PACIENTE
// ============================================================

export async function getPatientHistory(
    patientId
) {

    const response =
        await request(
            `/pacientes/${encodeURIComponent(
                patientId
            )}/historial/`
        );

    return response.historial || [];
}


// ============================================================
// REGISTRO CLÍNICO
// ============================================================

export async function createClinicalRecord(
    data
) {

    return request(
        "/registros/",
        {
            method: "POST",
            body: JSON.stringify(data)
        }
    );
}


// ============================================================
// BLOCKCHAIN - ESTADO
// ============================================================

export async function getBlockchainStatus() {

    return request(
        "/blockchain/status/"
    );
}


// ============================================================
// BLOCKCHAIN - BLOQUES
// ============================================================

export async function getBlockchainBlocks() {

    return request(
        "/blockchain/blocks/"
    );
}


// ============================================================
// BLOCKCHAIN - GENESIS
// ============================================================

export async function createGenesis(
    complexity = 4,
    proofChar = "0"
) {

    return request(
        "/blockchain/genesis/",
        {
            method: "POST",
            body: JSON.stringify({
                complexity,
                proof_char: proofChar
            })
        }
    );
}