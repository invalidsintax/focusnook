/**
 * Google Drive Storage Adapter
 * Handles authentication and file operations with Google Drive API
 */

const CLIENT_ID = '84500468335-8beq77hbisnrkfuqm7r2h0n9dhn6t01s.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Internal state
let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let tokenExpiry = null;
let configFileId = null;

let scriptsPromise = null;

// Load Google Scripts dynamically (Singleton)
export const loadGoogleScripts = () => {
    if (scriptsPromise) return scriptsPromise;

    scriptsPromise = new Promise((resolve, reject) => {
        if (window.google && window.gapi) {
            resolve();
            return;
        }

        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.async = true;
        script1.defer = true;
        script1.onload = () => {
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    gapiInited = true;
                    if (gisInited) resolve();
                } catch (err) {
                    reject(err);
                }
            });
        };
        script1.onerror = () => reject(new Error('Failed to load gapi script'));
        document.body.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.async = true;
        script2.defer = true;
        script2.onload = () => {
            try {
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (resp) => {
                        if (resp.error !== undefined) {
                            throw (resp);
                        }
                        accessToken = resp.access_token;
                    },
                });
                gisInited = true;
                if (gapiInited) resolve();
            } catch (err) {
                reject(err);
            }
        };
        script2.onerror = () => reject(new Error('Failed to load GIS script'));
        document.body.appendChild(script2);
    });

    return scriptsPromise;
};

// Check if we have a valid token (simple check)
// Check if we have a valid token (simple check)
const hasValidToken = () => {
    return accessToken !== null && tokenExpiry > Date.now();
};

const saveToken = (token) => {
    accessToken = token;
    // Tokens typically last 1 hour (3599 seconds). Set expiry one minute short for safety.
    tokenExpiry = Date.now() + (3550 * 1000);
    localStorage.setItem('gdrive_token', accessToken);
    localStorage.setItem('gdrive_expiry', tokenExpiry);

    // Crucial: Tell gapi about the token so client calls work
    if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken({ access_token: accessToken });
    }
};

const clearToken = () => {
    accessToken = null;
    tokenExpiry = null;
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_expiry');
};

// Trigger Auth Flow
export const authenticate = () => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error('Google Scripts not loaded'));
            return;
        }

        // Override the callback to resolve the promise
        tokenClient.callback = (resp) => {
            if (resp.error) {
                reject(resp);
            } else {
                saveToken(resp.access_token);
                resolve(resp.access_token);
            }
        };

        // Request token - removed prompt: 'consent' to allow silent auth if possible
        tokenClient.requestAccessToken({});
    });
};

class GoogleDriveAdapter {
    constructor() {
        this.cache = {}; // Local cache to avoid excessive API calls
        this.saveTimeout = null;
    }

    async initialize() {
        await loadGoogleScripts();
    }

    async connect() {
        await this.initialize(); // Ensure scripts are loaded
        if (!gisInited || !gapiInited) {
            throw new Error('Google scripts failed to initialize');
        }
        await authenticate();
        await this.findOrCreateConfigFile();
        return true;
    }

    async restoreSession() {
        try {
            await this.initialize();
        } catch (e) {
            alert('Google Scripts Failed to Load: ' + e.message);
            return false;
        }

        const savedToken = localStorage.getItem('gdrive_token');
        const savedExpiry = localStorage.getItem('gdrive_expiry');
        const now = Date.now();

        console.log('[Drive Debug] restoring session...', { savedToken: !!savedToken, savedExpiry, now, isValid: savedToken && savedExpiry && Number(savedExpiry) > now });

        if (savedToken && savedExpiry && Number(savedExpiry) > now) {
            accessToken = savedToken;
            tokenExpiry = Number(savedExpiry);

            // Crucial: Tell gapi about the restored token
            if (window.gapi && window.gapi.client) {
                console.log('[Drive Debug] Setting token in gapi');
                window.gapi.client.setToken({ access_token: accessToken });
            }

            try {
                console.log('[Drive Debug] Finding config file...');
                await this.findOrCreateConfigFile();
                console.log('[Drive Debug] Session restored successfully');
                return true;
            } catch (err) {
                console.warn('[Drive Debug] Cached token invalid or expired on usage:', err);
                // Specific alert for the actual API failure
                alert('Session Restore API Error: ' + (err.message || JSON.stringify(err)));
                // Don't clear token immediately so we can see what happened, but usually we should.
                clearToken();
                return false;
            }
        } else {
            console.log('[Drive Debug] No valid token found in storage.');
            if (savedToken) {
                alert('Session expired or invalid. Please login again.');
            }
            return false;
        }
    }

    async findOrCreateConfigFile() {
        try {
            // 1. Search for 'focusnook-data.json'
            const response = await window.gapi.client.drive.files.list({
                q: "name = 'focusnook-data.json' and trashed = false",
                fields: 'files(id, name)',
            });

            const files = response.result.files;

            if (files && files.length > 0) {
                configFileId = files[0].id;
                // Pre-load data into cache
                await this.loadAllData();
            } else {
                // 2. Create if not exists
                await this.createConfigFile();
            }
        } catch (err) {
            console.error('Error finding config file:', err);
            throw err;
        }
    }

    async createConfigFile() {
        const fileMetadata = {
            name: 'focusnook-data.json',
            mimeType: 'application/json',
        };

        // Initial empty state
        const media = {
            mimeType: 'application/json',
            body: JSON.stringify({}),
        };

        try {
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify({})], { type: 'application/json' }));

            // GAPI doesn't support multipart upload easily, using fetch for creation
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                },
                body: form,
            });
            const data = await res.json();
            configFileId = data.id;
            this.cache = {};
        } catch (err) {
            console.error('Error creating file:', err);
            throw err;
        }
    }

    async loadAllData() {
        if (!configFileId) return;

        try {
            const response = await window.gapi.client.drive.files.get({
                fileId: configFileId,
                alt: 'media',
            });

            this.cache = response.result || {};
        } catch (err) {
            console.error('Error loading data:', err);
            this.cache = {};
        }
    }

    async saveAllData() {
        if (!configFileId) {
            console.warn('saveAllData: No configFileId, skipping save.');
            return;
        }

        console.log('Saving data to Drive...', { configFileId, keyCount: Object.keys(this.cache).length });

        try {
            const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${configFileId}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.cache),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Drive Save Failed:', response.status, errorText);
            } else {
                console.log('Drive Save Success:', await response.json());
            }
        } catch (err) {
            console.error('Error saving data:', err);
        }
    }

    // --- Storage Interface Implementation ---

    async getItem(key) {
        // If not connected or initialized, return null (fallback behavior)
        if (!accessToken && !configFileId) return null;

        // If we have a file ID but empty cache, try loading used
        if (configFileId && Object.keys(this.cache).length === 0) {
            await this.loadAllData();
        }

        return this.cache[key] || null;
    }

    async setItem(key, value) {
        // console.log('setItem queued:', key);
        this.cache[key] = value;

        // Debounce save to avoid hitting API rate limits
        if (this.saveTimeout) clearTimeout(this.saveTimeout);

        this.saveTimeout = setTimeout(async () => {
            await this.saveAllData();
        }, 2000); // Save after 2 seconds of inactivity
    }

    async removeItem(key) {
        delete this.cache[key];
        await this.saveAllData(); // Immediate save for removals
    }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
