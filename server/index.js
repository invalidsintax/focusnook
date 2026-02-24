import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { startAuth, authCallback, authSession, authLogout } from './routes/auth.js';
import { getDriveData, saveDriveDataRoute } from './routes/drive.js';
import { proxyTodoist } from './routes/todoist.js';

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Todoist-Token');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  next();
});

app.get('/api/auth/google/start', startAuth);
app.get('/api/auth/google/callback', authCallback);
app.get('/api/auth/session', authSession);
app.post('/api/auth/logout', authLogout);

app.get('/api/drive/data', getDriveData);
app.post('/api/drive/data', saveDriveDataRoute);

// Todoist proxy – forwards all methods to api.todoist.com server-side
app.all('/api/todoist/*', proxyTodoist);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
