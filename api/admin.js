import crypto from 'node:crypto';
import { sb, LANDING_ID } from './_supabase.js';

function autorizado(req) {
    const esperada = process.env.ADMIN_PASSWORD || '';
    const recibida = String(req.headers['x-admin-key'] || '');
    if (!esperada || !recibida) return false;
    const a = crypto.createHash('sha256').update(esperada).digest();
    const b = crypto.createHash('sha256').update(recibida).digest();
    return crypto.timingSafeEqual(a, b);
}

const limpiarNumero = (n) => String(n || '').replace(/\D/g, '');
const limpiarNombre = (s) => String(s || '').trim().slice(0, 60);

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!autorizado(req)) {
        res.status(401).json({ error: 'Contraseña incorrecta' });
        return;
    }

    const base = `wa_numeros?landing_id=eq.${LANDING_ID}`;
    const body = req.body || {};

    try {
        if (req.method === 'GET') {
            const rows = await sb(`${base}&select=id,numero,nombre,activo,clicks,last_used&order=id`);
            res.status(200).json(rows);
            return;
        }

        if (req.method === 'POST') {
            const numero = limpiarNumero(body.numero);
            if (numero.length < 10 || numero.length > 15) {
                res.status(400).json({ error: 'Número inválido: usá formato internacional, ej. 5491133633742' });
                return;
            }
            const [row] = await sb('wa_numeros', {
                method: 'POST',
                prefer: 'return=representation',
                body: { landing_id: LANDING_ID, numero, nombre: limpiarNombre(body.nombre) || null }
            });
            res.status(201).json(row);
            return;
        }

        const id = parseInt(body.id ?? req.query.id, 10);
        if (!Number.isInteger(id)) {
            res.status(400).json({ error: 'Falta id' });
            return;
        }

        if (req.method === 'PATCH') {
            const cambios = {};
            if (typeof body.activo === 'boolean') cambios.activo = body.activo;
            if (body.nombre !== undefined) cambios.nombre = limpiarNombre(body.nombre) || null;
            if (body.resetClicks === true) cambios.clicks = 0;
            const [row] = await sb(`${base}&id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: cambios });
            res.status(200).json(row || null);
            return;
        }

        if (req.method === 'DELETE') {
            await sb(`${base}&id=eq.${id}`, { method: 'DELETE' });
            res.status(204).end();
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        const dup = e.status === 409;
        res.status(dup ? 409 : 500).json({ error: dup ? 'Ese número ya está cargado' : e.message });
    }
}
