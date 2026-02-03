import { useState, useEffect } from 'react';
import { X, Keyboard, RotateCcw, Timer, Volume2, CheckSquare, StickyNote, Calendar, Link, Unlink, Loader2, ChevronDown, Music } from 'lucide-react';
import { validateToken, getProjects, FILTER_OPTIONS } from '../services/todoistApi';
import { googleDriveAdapter } from '../services/googleDrive';
import { storage, LocalStorageAdapter } from '../services/storage';

// Available widgets configuration
const WIDGET_CONFIG = [
  { id: 'pomodoro', label: 'Focus Timer', icon: Timer, shortcut: '1' },
  // { id: 'sounds', label: 'Ambient Sounds', icon: Volume2, shortcut: '2' },
  { id: 'todos', label: 'Tasks', icon: CheckSquare, shortcut: '3' },
  { id: 'notes', label: 'Notes', icon: StickyNote, shortcut: '4' },
  { id: 'planner', label: 'Daily Planner', icon: Calendar, shortcut: '5' },
  { id: 'music', label: 'Music Player', icon: Music, shortcut: '6' },
  { id: 'focusprep', label: 'Focus Prep', icon: Timer, shortcut: '7' },
];

export default function SettingsPanel({ settings, enabledWidgets, todoistConfig, onUpdateSettings, onUpdateTodoistConfig, onToggleWidgetEnabled, onClose, onResetPositions, onDriveConnected }) {
  const [tokenInput, setTokenInput] = useState(todoistConfig?.token || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;

    setIsConnecting(true);
    setConnectionError('');

    const result = await validateToken(tokenInput.trim());

    if (result.valid) {
      onUpdateTodoistConfig({ token: tokenInput.trim(), isConnected: true, selectedFilter: 'today' });
    } else {
      setConnectionError('Invalid API token. Please check and try again.');
    }

    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    onUpdateTodoistConfig({ token: '', isConnected: false, selectedFilter: 'today' });
    setTokenInput('');
    setConnectionError('');
    setProjects([]);
  };

  // Fetch projects when connected
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  useEffect(() => {
    if (todoistConfig?.isConnected && todoistConfig?.token) {
      setIsLoadingProjects(true);
      getProjects(todoistConfig.token)
        .then(setProjects)
        .catch(console.error)
        .finally(() => setIsLoadingProjects(false));
    }
  }, [todoistConfig?.isConnected, todoistConfig?.token]);

  const filterOptions = [
    ...FILTER_OPTIONS,
    ...projects.map(p => ({ id: p.id, name: p.name, type: 'project' }))
  ];

  const selectedFilterName = filterOptions.find(f => f.id === todoistConfig?.selectedFilter)?.name || 'Today';
  const shortcuts = [
    { keys: ['Space'], action: 'Play/Pause Timer' },
    { keys: ['R'], action: 'Reset Timer' },
    { keys: ['1-7'], action: 'Toggle Widgets' },
    { keys: ['S'], action: 'Open Spaces' },
    { keys: ['F'], action: 'Toggle Fullscreen' },
    { keys: ['Esc'], action: 'Close Modals' },
  ];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel glass-panel animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          {/* Widgets */}
          <section className="settings-section">
            <h3>Widgets</h3>
            <p className="section-description">Enable widgets to add them to the dock</p>
            <div className="widget-toggles">
              {WIDGET_CONFIG.map(widget => {
                const Icon = widget.icon;
                const isEnabled = enabledWidgets[widget.id];
                return (
                  <label
                    key={widget.id}
                    className={`widget-toggle ${isEnabled ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => onToggleWidgetEnabled(widget.id)}
                    />
                    <Icon size={20} />
                    <span className="widget-label">{widget.label}</span>
                    <kbd>{widget.shortcut}</kbd>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Appearance */}
          <section className="settings-section">
            <h3>Appearance</h3>

            <div className="setting-item">
              <label>Widget Opacity</label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={settings.widgetOpacity}
                onChange={(e) => onUpdateSettings({ widgetOpacity: parseFloat(e.target.value) })}
              />
              <span className="value">{Math.round(settings.widgetOpacity * 100)}%</span>
            </div>

            <div className="setting-item">
              <label>Show Clock</label>
              <button
                className={`toggle-btn ${settings.showClock ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ showClock: !settings.showClock })}
              >
                {settings.showClock ? 'On' : 'Off'}
              </button>
            </div>

            <div className="setting-item">
              <label>12-Hour Format</label>
              <button
                className={`toggle-btn ${settings.use12Hour ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ use12Hour: !settings.use12Hour })}
              >
                {settings.use12Hour ? 'On' : 'Off'}
              </button>
            </div>
          </section>

          {/* Daily Planner */}
          <section className="settings-section">
            <h3>
              <Calendar size={18} />
              Daily Planner
            </h3>
            <p className="section-description">Set your work day start and end times</p>

            <div className="setting-item">
              <label>Work Day Start</label>
              <div className="select-wrapper time-select">
                <select
                  value={settings.plannerStartHour || 9}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value);
                    // Ensure end is after start
                    const newEnd = settings.plannerEndHour <= newStart ? newStart + 1 : settings.plannerEndHour;
                    onUpdateSettings({ plannerStartHour: newStart, plannerEndHour: newEnd });
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                    <option key={hour} value={hour}>
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
            </div>

            <div className="setting-item">
              <label>Work Day End</label>
              <div className="select-wrapper time-select">
                <select
                  value={settings.plannerEndHour || 17}
                  onChange={(e) => {
                    const newEnd = parseInt(e.target.value);
                    onUpdateSettings({ plannerEndHour: newEnd });
                  }}
                >
                  {Array.from({ length: 24 - (settings.plannerStartHour || 9) }, (_, i) => (settings.plannerStartHour || 9) + 1 + i)
                    .filter(hour => hour <= 24)
                    .map(hour => (
                      <option key={hour} value={hour}>
                        {hour === 24 ? '12 AM (midnight)' : hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </option>
                    ))}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
            </div>
          </section>

          {/* Layout */}
          <section className="settings-section">
            <h3>Layout</h3>
            <button className="reset-btn" onClick={onResetPositions}>
              <RotateCcw size={16} />
              Reset Widget Positions
            </button>
          </section>

          {/* Integrations */}
          <section className="settings-section">
            <h3>
              <Link size={18} />
              Integrations
            </h3>

            <div className="integration-item">
              <div className="integration-header">
                <span className="integration-name">Google Drive</span>
                <span className={`connection-status ${storage.getType() === 'gdrive' ? 'connected' : ''}`}>
                  {storage.getType() === 'gdrive' ? 'Connected' : 'Not connected'}
                </span>
              </div>

              {storage.getType() !== 'gdrive' ? (
                <>
                  <p className="integration-description">
                    Connect Google Drive to sync your settings and data across devices.
                  </p>
                  <button
                    className="connect-btn"
                    onClick={async () => {
                      try {
                        const connected = await googleDriveAdapter.connect();
                        if (connected) {
                          if (onDriveConnected) {
                            onDriveConnected();
                          }
                        }
                      } catch (err) {
                        console.error('Failed to connect Drive:', err);
                        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
                        alert('Failed to connect to Google Drive: ' + msg);
                      }
                    }}
                  >
                    <Link size={16} />
                    Connect Drive
                  </button>
                </>
              ) : (
                <>
                  <p className="integration-description">
                    Your data is being saved to 'FocusNook/focusnook-data.json' in your Google Drive.
                  </p>
                  <button
                    className="disconnect-btn"
                    onClick={() => {
                      storage.setAdapter(new LocalStorageAdapter());
                      window.location.reload(); // Reload to switch back to local storage
                    }}
                  >
                    <Unlink size={16} />
                    Disconnect
                  </button>
                </>
              )}
            </div>

            <div className="integration-item">
              <div className="integration-header">
                <span className="integration-name">Todoist</span>
                <span className={`connection-status ${todoistConfig?.isConnected ? 'connected' : ''}`}>
                  {todoistConfig?.isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              {!todoistConfig?.isConnected ? (
                <>
                  <p className="integration-description">
                    Connect to sync your tasks with Todoist.
                    <a href="https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB" target="_blank" rel="noopener noreferrer"> Get your API token →</a>
                  </p>
                  <div className="token-input-group">
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste your Todoist API token"
                      className="token-input"
                    />
                    <button
                      className="connect-btn"
                      onClick={handleConnect}
                      disabled={isConnecting || !tokenInput.trim()}
                    >
                      {isConnecting ? <Loader2 size={16} className="spinning" /> : <Link size={16} />}
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>
                  {connectionError && (
                    <p className="connection-error">{connectionError}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="filter-selector">
                    <label>Show tasks from:</label>
                    <div className="select-wrapper">
                      <select
                        value={todoistConfig?.selectedFilter || 'today'}
                        onChange={(e) => onUpdateTodoistConfig({ selectedFilter: e.target.value })}
                        disabled={isLoadingProjects}
                      >
                        <optgroup label="Filters">
                          {FILTER_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </optgroup>
                        {projects.length > 0 && (
                          <optgroup label="Projects">
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown size={14} className="select-arrow" />
                    </div>
                  </div>
                  <button className="disconnect-btn" onClick={handleDisconnect}>
                    <Unlink size={16} />
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="settings-section">
            <h3>
              <Keyboard size={18} />
              Keyboard Shortcuts
            </h3>
            <div className="shortcuts-list">
              {shortcuts.map((shortcut, i) => (
                <div key={i} className="shortcut-item">
                  <div className="shortcut-keys">
                    {shortcut.keys.map((key, j) => (
                      <kbd key={j}>{key}</kbd>
                    ))}
                  </div>
                  <span className="shortcut-action">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <style>{`
          .settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: var(--z-modal);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-8);
            animation: fadeIn var(--transition-fast) ease-out;
          }
          
          .settings-panel {
            width: 100%;
            max-width: 480px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-6);
            border-bottom: 1px solid var(--glass-border);
          }
          
          .settings-header h2 {
            font-size: var(--font-size-xl);
            font-weight: 600;
          }
          
          .close-btn {
            width: 36px;
            height: 36px;
          }
          
          .settings-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-6);
          }
          
          .settings-section {
            margin-bottom: var(--space-8);
          }
          
          .settings-section:last-child {
            margin-bottom: 0;
          }
          
          .settings-section h3 {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--font-size-sm);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-text-muted);
            margin-bottom: var(--space-4);
          }
          
          .section-description {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            margin-bottom: var(--space-3);
            margin-top: calc(-1 * var(--space-2));
          }
          
          .widget-toggles {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }
          
          .widget-toggle {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            transition: all var(--transition-fast);
            cursor: pointer;
          }
          
          .widget-toggle:hover {
            background: var(--color-surface-hover);
          }
          
          .widget-toggle.active {
            background: rgba(99, 102, 241, 0.15);
            border-color: var(--color-accent);
            color: var(--color-text);
          }
          
          .widget-toggle .widget-label {
            flex: 1;
            text-align: left;
          }
          
          .widget-toggle input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: var(--color-accent);
            cursor: pointer;
          }
          
          .widget-toggle kbd {
            opacity: 0.6;
          }
          
          .setting-item {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-3) 0;
          }
          
          .setting-item label {
            flex: 1;
            font-size: var(--font-size-sm);
          }
          
          .setting-item input[type="range"] {
            width: 120px;
          }
          
          .setting-item .value {
            width: 40px;
            text-align: right;
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
          }
          
          .toggle-btn {
            padding: var(--space-2) var(--space-4);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            font-weight: 500;
            color: var(--color-text-secondary);
            transition: all var(--transition-fast);
          }
          
          .toggle-btn.active {
            background: var(--color-accent);
            border-color: var(--color-accent);
            color: white;
          }
          
          .reset-btn {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-3) var(--space-4);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            transition: all var(--transition-fast);
          }
          
          .reset-btn:hover {
            background: var(--color-surface-hover);
            color: var(--color-text-primary);
          }
          
          .shortcuts-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }
          
          .shortcut-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-2) 0;
          }
          
          .shortcut-keys {
            display: flex;
            gap: var(--space-1);
          }
          
          kbd {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 24px;
            padding: 0 var(--space-2);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            font-size: var(--font-size-xs);
            font-family: inherit;
            font-weight: 500;
          }
          
          .shortcut-action {
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
          }
          
          .integration-item {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--space-4);
          }
          
          .integration-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-3);
          }
          
          .integration-name {
            font-weight: 600;
            font-size: var(--font-size-sm);
          }
          
          .connection-status {
            font-size: var(--font-size-xs);
            padding: var(--space-1) var(--space-2);
            border-radius: var(--radius-full);
            background: var(--color-surface-hover);
            color: var(--color-text-muted);
          }
          
          .connection-status.connected {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
          }
          
          .integration-description {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            margin-bottom: var(--space-3);
          }
          
          .integration-description a {
            color: var(--color-accent);
            text-decoration: none;
          }
          
          .integration-description a:hover {
            text-decoration: underline;
          }
          
          .token-input-group {
            display: flex;
            gap: var(--space-2);
          }
          
          .token-input {
            flex: 1;
            padding: var(--space-2) var(--space-3);
            font-size: var(--font-size-sm);
          }
          
          .connect-btn, .disconnect-btn {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            font-weight: 500;
            transition: all var(--transition-fast);
            white-space: nowrap;
          }
          
          .connect-btn {
            background: var(--color-accent);
            color: white;
            border: none;
          }
          
          .connect-btn:hover:not(:disabled) {
            background: var(--color-accent-hover);
          }
          
          .connect-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .disconnect-btn {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            color: var(--color-text-secondary);
          }
          
          .disconnect-btn:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: #ef4444;
            color: #ef4444;
          }
          
          .connection-error {
            margin-top: var(--space-2);
            font-size: var(--font-size-xs);
            color: #ef4444;
          }
          
          .spinning {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .filter-selector {
            margin-bottom: var(--space-3);
          }
          
          .filter-selector label {
            display: block;
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            margin-bottom: var(--space-2);
          }
          
          .select-wrapper {
            position: relative;
            display: inline-block;
            width: 100%;
          }
          
          .select-wrapper select {
            width: 100%;
            padding: var(--space-2) var(--space-3);
            padding-right: var(--space-8);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            color: var(--color-text);
            appearance: none;
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          
          .select-wrapper select:hover {
            border-color: var(--color-accent);
          }
          
          .select-wrapper select:focus {
            outline: none;
            border-color: var(--color-accent);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
          }
          
          .select-arrow {
            position: absolute;
            right: var(--space-3);
            top: 50%;
            transform: translateY(-50%);
            color: var(--color-text-muted);
            pointer-events: none;
          }
        `}</style>
      </div >
    </div >
  );
}
