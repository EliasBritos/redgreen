export const LANDING_ID = 'redgreen';

// Llamada a la REST API de Supabase con la service_role key (solo server-side).
export async function sb(path, { method = 'GET', body, prefer } = {}) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados');

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
    };
    if (prefer) headers.Prefer = prefer;

    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(4000)
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const err = new Error(data?.message || `Supabase ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}
