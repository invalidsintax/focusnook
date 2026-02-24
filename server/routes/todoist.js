/**
 * Todoist API Proxy
 * Forwards requests to api.todoist.com server-side to avoid browser CORS restrictions.
 * The client sends the Todoist token in the X-Todoist-Token header.
 */

const TODOIST_BASE = 'https://api.todoist.com/rest/v2';

async function proxyTodoist(req, res) {
    const token = req.headers['x-todoist-token'];
    if (!token) {
        return res.status(401).json({ error: 'Missing Todoist token' });
    }

    // Build the upstream URL: strip the /api/todoist prefix, keep the rest
    const upstreamPath = req.path; // e.g. /tasks, /tasks/:id/close
    const query = new URLSearchParams(req.query).toString();
    const url = `${TODOIST_BASE}${upstreamPath}${query ? `?${query}` : ''}`;

    const fetchOptions = {
        method: req.method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length) {
        fetchOptions.body = JSON.stringify(req.body);
    }

    try {
        const upstream = await fetch(url, fetchOptions);

        // Pass status through
        res.status(upstream.status);

        // 204 No Content – nothing to forward
        if (upstream.status === 204) {
            return res.end();
        }

        const data = await upstream.json();
        return res.json(data);
    } catch (err) {
        console.error('Todoist proxy error:', err);
        return res.status(502).json({ error: 'Failed to reach Todoist API' });
    }
}

export { proxyTodoist };
