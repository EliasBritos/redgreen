import { sb, LANDING_ID } from './_supabase.js';

const PIXEL_ID = '1151311860561211';

// Si Supabase no responde, el boton igual funciona con esta lista (eleccion al azar).
const FALLBACK_NUMEROS = [
    '5491133633742',
    '5491133633748',
    '5491133633847',
    '5491176243646',
    '5493548591305',
    '5493548603069',
    '5493548616968'
];

const WA_MSGS = [
    'Hola! Quiero reclamar mi bono del 50%…',
    'Hola! Me gustaría reclamar el bono del 50%, ¿me ayudan?',
    'Buenas! Quiero activar el bono del 50%, ¿cómo hago?',
    'Hola! Vi la promo del 50% de bono y quiero aprovecharla.',
    'Buenas, quiero acceder al bono del 50%, ¿me indican cómo?',
    'Hola! Vengo por la promo del bono 50%, ¿cómo lo reclamo?',
    'Buenas! Quería consultar cómo obtener el bono del 50%.',
    'Hola! ¿Me pueden dar el bono del 50% de bienvenida?',
    'Buenas! Estoy interesado en aprovechar el bono del 50%.',
    'Hola! Quiero usar la promo del 50%, ¿me ayudan?',
    'Buenas! ¿Cómo hago para reclamar el bono del 50%?'
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function parseCookies(header = '') {
    const out = {};
    header.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

async function elegirNumero() {
    try {
        const numero = await sb('rpc/next_wa_numero', { method: 'POST', body: { p_landing: LANDING_ID } });
        if (numero) return numero;
        console.warn('[wa] no hay numeros activos en Supabase, uso fallback');
    } catch (e) {
        console.error('[wa] error Supabase, uso fallback:', e.message);
    }
    return pick(FALLBACK_NUMEROS);
}

// Lead server-side (Conversions API). Usa el mismo eid que el Lead del Pixel para deduplicar.
async function enviarLead(req, { eid, fbclid }) {
    const token = process.env.META_CAPI_ACCESS_TOKEN;
    if (!token || !eid) return;

    const cookies = parseCookies(req.headers.cookie);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const userData = {
        client_ip_address: ip || undefined,
        client_user_agent: req.headers['user-agent'] || undefined,
        fbp: cookies._fbp || undefined,
        fbc: cookies._fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined)
    };

    const payload = {
        data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eid,
            action_source: 'website',
            event_source_url: req.headers.referer || `https://${req.headers.host}/`,
            user_data: userData,
            custom_data: { content_name: 'WhatsApp Click' }
        }]
    };
    if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

    try {
        const res = await fetch(
            `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(1500)
            }
        );
        if (!res.ok) console.error('[wa] CAPI error:', await res.text());
    } catch (e) {
        console.error('[wa] CAPI fallo:', e.message);
    }
}

export default async function handler(req, res) {
    const eid = /^[a-f0-9]{8,64}$/i.test(req.query.eid || '') ? req.query.eid : '';
    const fbclid = String(req.query.fbclid || '').slice(0, 500);

    const [numero] = await Promise.all([elegirNumero(), enviarLead(req, { eid, fbclid })]);

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(pick(WA_MSGS))}`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
}
