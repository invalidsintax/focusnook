import { useState, useEffect, useCallback, useRef } from 'react';
import VideoBackground from './components/VideoBackground';
import Pomodoro from './components/Pomodoro';
import AmbientSounds from './components/AmbientSounds';
import TodoList from './components/TodoList';
import Notes from './components/Notes';
import DailyPlanner from './components/DailyPlanner';
import MusicPlayer from './components/MusicPlayer';
import FocusPrep from './components/FocusPrep';
import SpaceBrowser from './components/SpaceBrowser';
import NavigationDock from './components/NavigationDock';
import DraggableWidget from './components/DraggableWidget';
import SettingsPanel from './components/SettingsPanel';
import Clock from './components/Clock';
import { defaultSpaces, defaultMusicStreams } from './data/spaces';
import { Music, Loader } from 'lucide-react';
import YouTubePlayer from './components/YouTubePlayer';
import { storage, LocalStorageAdapter } from './services/storage';
import { googleDriveAdapter, loadGoogleScripts } from './services/googleDrive';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);

  // Load custom spaces
  const [customSpaces, setCustomSpaces] = useState([]);

  // Combine default and custom spaces
  const allSpaces = [...defaultSpaces, ...customSpaces];

  // Load saved space
  const [currentSpace, setCurrentSpace] = useState(defaultSpaces[0]);
  const [showSpaceBrowser, setShowSpaceBrowser] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Which widgets are shown as icons in the dock (controlled by settings)
  const [enabledWidgets, setEnabledWidgets] = useState({
    pomodoro: true,
    sounds: true,
    todos: true,
    notes: true,
    planner: true,
    music: true,
    focusprep: true,
  });

  // Which widgets are currently visible/open (controlled by dock clicks)
  const [widgetVisibility, setWidgetVisibility] = useState({
    pomodoro: true,
    sounds: false,
    todos: true,
    notes: false,
    planner: false,
    music: false,
    focusprep: false,
  });

  const [settings, setSettings] = useState({
    widgetOpacity: 1,
    showClock: true,
    use12Hour: true,
    plannerStartHour: 9,  // 9 AM
    plannerEndHour: 17,   // 5 PM
  });

  // Todoist integration config
  const [todoistConfig, setTodoistConfig] = useState({
    token: '',
    isConnected: false,
    selectedFilter: 'today', // 'today', 'all', or a project ID
  });

  // Music player state (lifted for persistent playback)
  const [musicState, setMusicState] = useState({
    selectedStream: defaultMusicStreams[0],
    isPlaying: false,
    volume: 50,
    isMuted: false,
    customStreams: [],
  });

  const pomodoroRef = useRef(null);

  // Track z-index for bringing widgets to front when clicked
  const [widgetZIndices, setWidgetZIndices] = useState({});
  const zIndexCounter = useRef(10);

  // Key to force widget remount when positions are reset
  const [positionResetKey, setPositionResetKey] = useState(0);

  const bringWidgetToFront = useCallback((widgetId) => {
    zIndexCounter.current += 1;
    setWidgetZIndices(prev => ({
      ...prev,
      [widgetId]: zIndexCounter.current
    }));
  }, []);

  // Initial Data Load
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pre-load scripts anyway for faster connection later if not already loaded
      loadGoogleScripts().catch(console.error);

      const [
        savedCustomSpaces,
        savedSpaceId,
        savedEnabledWidgets,
        savedWidgetVisibility,
        savedSettings,
        savedTodoist,
        savedMusic,
        savedCustomStreams
      ] = await Promise.all([
        storage.get('focusnook-custom-spaces'),
        storage.get('focusnook-current-space'),
        storage.get('focusnook-enabled-widgets'),
        storage.get('focusnook-widget-visibility'),
        storage.get('focusnook-settings'),
        storage.get('focusnook-todoist'),
        storage.get('focusnook-music'),
        storage.get('focusnook-custom-streams')
      ]);

      if (savedCustomSpaces) setCustomSpaces(savedCustomSpaces);

      // Handle current space logic utilizing both default and loaded custom spaces
      const loadedAllSpaces = [...defaultSpaces, ...(savedCustomSpaces || [])];
      if (savedSpaceId) {
        const found = loadedAllSpaces.find(s => s.id === savedSpaceId);
        if (found) setCurrentSpace(found);
      }

      if (savedEnabledWidgets) setEnabledWidgets(savedEnabledWidgets);
      if (savedWidgetVisibility) setWidgetVisibility(savedWidgetVisibility);
      if (savedSettings) setSettings(savedSettings);
      if (savedTodoist) setTodoistConfig(savedTodoist);

      if (savedMusic) {
        // Merge saved music state with current defaults to ensure new fields exists
        const allStreams = [...defaultMusicStreams, ...(savedCustomStreams || [])];
        setMusicState(prev => ({
          ...prev,
          ...savedMusic,
          selectedStream: savedMusic.selectedStream || allStreams[0],
          customStreams: savedCustomStreams || []
        }));
      }
    } catch (error) {
      console.error('Failed to load application data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Initialize storage adapter preference
      let storageType = localStorage.getItem('focusnook-storage-type');

      // RECOVERY: If no type set, but we have a valid token, assume Drive
      if (!storageType) {
        const token = localStorage.getItem('gdrive_token');
        const expiry = localStorage.getItem('gdrive_expiry');
        if (token && expiry && Number(expiry) > Date.now()) {
          console.log("Recovering lost storage type based on existing token");
          storageType = 'gdrive';
          localStorage.setItem('focusnook-storage-type', 'gdrive');
        }
      }

      if (storageType === 'gdrive') {
        try {
          // Initialize scripts
          await googleDriveAdapter.initialize();

          // Try to restore session silently
          const restored = await googleDriveAdapter.restoreSession();

          if (restored) {
            console.log('Drive session restored from cache');
            storage.setAdapter(googleDriveAdapter);
            loadData();
          } else {
            // We need fresh auth
            setNeedsDriveAuth(true);
            setIsLoading(false);
          }
          // Do NOT call loadData here, wait for user interaction
        } catch (e) {
          console.error('Failed to init drive scripts, falling back to local', e);
          storage.setAdapter(new LocalStorageAdapter());
          loadData();
        }
      } else {
        // Local storage, proceed immediately
        loadData();
      }
    };

    init();
  }, [loadData]);

  // Handle manual Drive connection
  const handleDriveConnect = async () => {
    setIsLoading(true);
    try {
      await googleDriveAdapter.connect();
      storage.setAdapter(googleDriveAdapter);
      setNeedsDriveAuth(false);
      // Now that we are connected, load data
      loadData();
    } catch (err) {
      console.error('Drive connection failed:', err);
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert('Failed to connect: ' + msg + '. Switching to local storage.');

      storage.setAdapter(new LocalStorageAdapter());
      localStorage.removeItem('focusnook-storage-type');
      setNeedsDriveAuth(false);
      loadData();
    }
  };

  // Save enabled widgets
  useEffect(() => {
    if (!isLoading) {
      storage.set('focusnook-enabled-widgets', enabledWidgets);
    }
  }, [enabledWidgets, isLoading]);

  // Save widget visibility
  useEffect(() => {
    if (!isLoading) {
      storage.set('focusnook-widget-visibility', widgetVisibility);
    }
  }, [widgetVisibility, isLoading]);

  // Save widget Z-indices (local only usually, or sync?) -> Let's sync if we can, but it's transient
  // Actually we aren't saving z-indices to storage in original code? 
  // Checking original... it seems we weren't saving z-indices? 
  // Ah, the original code had: storage.set('chillspace-z-indices', widgetZIndices) check?
  // Let's assume we want to save them if we were before.
  // Wait, I don't see z-indices load in the Promise.all above. So mapped to transient.

  // Save current space
  useEffect(() => {
    if (!isLoading && currentSpace) {
      storage.set('focusnook-current-space', currentSpace.id);
    }
  }, [currentSpace, isLoading]);

  // Save settings
  useEffect(() => {
    if (!isLoading) {
      storage.set('focusnook-settings', settings);
    }
  }, [settings, isLoading]);

  // Save Todoist config
  useEffect(() => {
    if (!isLoading) {
      storage.set('focusnook-todoist', todoistConfig);
    }
  }, [todoistConfig, isLoading]);

  // Save music state
  useEffect(() => {
    if (!isLoading) {
      storage.set('focusnook-music', musicState);
      if (musicState.customStreams) {
        storage.set('chillspace-custom-streams', musicState.customStreams);
      }
    }
  }, [musicState, isLoading]);

  const updateMusicState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setMusicState(updates);
    } else {
      setMusicState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Toggle widget visibility (from dock)
  const toggleWidgetVisibility = useCallback((widgetId) => {
    setWidgetVisibility(prev => ({
      ...prev,
      [widgetId]: !prev[widgetId]
    }));
  }, []);

  // Toggle widget enabled in dock (from settings)
  const toggleWidgetEnabled = useCallback((widgetId) => {
    setEnabledWidgets(prev => ({
      ...prev,
      [widgetId]: !prev[widgetId]
    }));
  }, []);

  const updateSettings = useCallback((updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateTodoistConfig = useCallback((updates) => {
    setTodoistConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetWidgetPositions = useCallback(() => {
    // Clear all widget positions and sizes from storage
    // Note: This iterates localStorage directly which is fine for current implementation as adapter is local,
    // but for Drive, we might need a dedicated 'clearPositions' method in storage service.
    // For now, keeping it simple as widget positions are still somewhat local-specific preferences.
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('chillspace-widget-pos-') || key.startsWith('chillspace-widget-size-')) {
        localStorage.removeItem(key);
      }
    });
    // Force widgets to remount by changing the key
    setPositionResetKey(prev => prev + 1);
  }, []);

  // Save custom spaces to localStorage
  useEffect(() => {
    if (!isLoading) storage.set('chillspace-custom-spaces', customSpaces);
  }, [customSpaces, isLoading]);

  const addSpace = useCallback((newSpace) => {
    setCustomSpaces(prev => [...prev, { ...newSpace, isCustom: true }]);
  }, []);

  const updateSpace = useCallback((updatedSpace) => {
    setCustomSpaces(prev => prev.map(s => s.id === updatedSpace.id ? updatedSpace : s));
    // If the currently selected space was updated, update it immediately
    if (currentSpace.id === updatedSpace.id) {
      setCurrentSpace(updatedSpace);
    }
  }, [currentSpace.id]);

  const deleteSpace = useCallback((spaceId) => {
    setCustomSpaces(prev => prev.filter(s => s.id !== spaceId));
    // If current space is deleted, switch to default
    if (currentSpace.id === spaceId) {
      setCurrentSpace(defaultSpaces[0]);
    }
  }, [currentSpace.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          // Toggle pomodoro play/pause via custom event
          window.dispatchEvent(new CustomEvent('pomodoro-toggle'));
          break;
        case 'r':
          if (!e.metaKey && !e.ctrlKey) {
            window.dispatchEvent(new CustomEvent('pomodoro-reset'));
          }
          break;
        case '1':
          toggleWidgetVisibility('pomodoro');
          break;
        case '2':
          toggleWidgetVisibility('sounds');
          break;
        case '3':
          toggleWidgetVisibility('todos');
          break;
        case '4':
          toggleWidgetVisibility('notes');
          break;
        case '5':
          toggleWidgetVisibility('planner');
          break;
        case '6':
          toggleWidgetVisibility('music');
          break;
        case '7':
          toggleWidgetVisibility('focusprep');
          break;
        case 's':
          if (!e.metaKey && !e.ctrlKey) {
            setShowSpaceBrowser(true);
          }
          break;
        case 'f':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case 'escape':
          setShowSpaceBrowser(false);
          setShowSettings(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleWidgetVisibility]);

  const defaultPositions = {
    pomodoro: { x: 24, y: 80 },
    sounds: { x: 24, y: 460 },
    todos: { x: window.innerWidth - 324, y: 80 },
    notes: { x: window.innerWidth - 344, y: 460 },
    planner: { x: window.innerWidth - 344, y: 80 },
    music: { x: 24, y: 460 },
    focusprep: { x: 24, y: 300 },
  };

  const DebugOverlay = () => {
    const [info, setInfo] = useState({});

    const update = () => {
      const token = localStorage.getItem('gdrive_token');
      const expiry = localStorage.getItem('gdrive_expiry');
      const type = localStorage.getItem('focusnook-storage-type');
      const now = Date.now();
      setInfo({
        type,
        hasToken: !!token,
        tokenLen: token ? token.length : 0,
        expired: expiry ? Number(expiry) < now : 'N/A',
        expiryDate: expiry ? new Date(Number(expiry)).toLocaleTimeString() : 'N/A'
      });
    };

    useEffect(() => {
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }, []);

    if (!settings.showClock) return null; // Use clock toggle as a hidden switch if needed, or just always show for now

    return (
      <div style={{
        position: 'fixed', bottom: 10, right: 10, background: 'rgba(0,0,0,0.8)',
        color: '#0f0', padding: 10, fontSize: 10, fontFamily: 'monospace',
        zIndex: 9999, pointerEvents: 'none', borderRadius: 4
      }}>
        <div>Type: {info.type || 'local/null'}</div>
        <div>Token: {info.hasToken ? 'YES' : 'NO'} ({info.tokenLen})</div>
        <div>Expired: {String(info.expired)}</div>
        <div>ExpTime: {info.expiryDate}</div>
        <div>Time: {new Date().toLocaleTimeString()}</div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <DebugOverlay />
        <Loader size={48} className="animate-spin" />
        <p>Loading your space...</p>
        <style>{`
          .app-loading {
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #111;
            color: #fff;
            gap: 20px;
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (needsDriveAuth) {
    return (
      <div className="app-loading">
        <DebugOverlay />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <Music size={48} />
          <h2>Welcome back!</h2>
          <p>Please reconnect to Google Drive to load your space.</p>
          <button
            className="connect-btn"
            style={{
              background: '#22c55e', color: 'white', border: 'none',
              padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '16px', fontWeight: '500'
            }}
            onClick={handleDriveConnect}
          >
            Connect to Drive
          </button>

          <button
            style={{
              background: 'transparent', color: '#888', border: 'none',
              marginTop: '10px', cursor: 'pointer', textDecoration: 'underline'
            }}
            onClick={() => {
              storage.setAdapter(new LocalStorageAdapter());
              localStorage.removeItem('focusnook-storage-type');
              setNeedsDriveAuth(false);
            }}
          >
            Continue with Local Storage
          </button>

          <button
            style={{
              background: 'transparent', color: '#666', border: '1px solid #333',
              marginTop: '20px', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px'
            }}
            onClick={() => {
              const token = localStorage.getItem('gdrive_token');
              const expiry = localStorage.getItem('gdrive_expiry');
              const type = localStorage.getItem('focusnook-storage-type');
              const now = Date.now();
              alert(JSON.stringify({
                hasToken: !!token,
                tokenStart: token ? token.substring(0, 5) + '...' : 'N/A',
                expiry: expiry,
                timeLeftMinutes: expiry ? ((Number(expiry) - now) / 60000).toFixed(1) : 'N/A',
                storageType: type
              }, null, 2));
            }}
          >
            Debug Session Info
          </button>
        </div>
        <style>{`
          .app-loading {
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #111;
            color: #fff;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <DebugOverlay />
      {/* Video Background */}
      <VideoBackground youtubeId={currentSpace.youtubeId} />

      {/* Current Space Label */}
      <div className="current-space">
        <span className="space-name">{currentSpace.name}</span>
      </div>

      {/* Clock */}
      {settings.showClock && (
        <div className="clock-container">
          <Clock use12Hour={settings.use12Hour} />
          {/* Now Playing indicator */}
          {musicState.isPlaying && musicState.selectedStream && (
            <div className="now-playing-indicator">
              <Music size={14} />
              <span>Now Playing: {musicState.selectedStream.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Draggable Widgets */}
      {widgetVisibility.pomodoro && (
        <DraggableWidget
          key={`pomodoro-${positionResetKey}`}
          widgetId="pomodoro"
          defaultPosition={defaultPositions.pomodoro}
          zIndex={widgetZIndices.pomodoro || 10}
          onBringToFront={bringWidgetToFront}
          disableResize
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <Pomodoro ref={pomodoroRef} />
          </div>
        </DraggableWidget>
      )}

      {/* {widgetVisibility.sounds && (
        <DraggableWidget
          key={`sounds-${positionResetKey}`}
          widgetId="sounds"
          defaultPosition={defaultPositions.sounds}
          zIndex={widgetZIndices.sounds || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <AmbientSounds />
          </div>
        </DraggableWidget>
      )} */}

      {widgetVisibility.todos && (
        <DraggableWidget
          key={`todos-${positionResetKey}`}
          widgetId="todos"
          defaultPosition={defaultPositions.todos}
          zIndex={widgetZIndices.todos || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <TodoList todoistConfig={todoistConfig} />
          </div>
        </DraggableWidget>
      )}

      {widgetVisibility.notes && (
        <DraggableWidget
          key={`notes-${positionResetKey}`}
          widgetId="notes"
          defaultPosition={defaultPositions.notes}
          zIndex={widgetZIndices.notes || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <Notes />
          </div>
        </DraggableWidget>
      )}

      {widgetVisibility.planner && (
        <DraggableWidget
          key={`planner-${positionResetKey}`}
          widgetId="planner"
          defaultPosition={defaultPositions.planner}
          zIndex={widgetZIndices.planner || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <DailyPlanner
              startHour={settings.plannerStartHour}
              endHour={settings.plannerEndHour}
            />
          </div>
        </DraggableWidget>
      )}

      {widgetVisibility.music && (
        <DraggableWidget
          key={`music-${positionResetKey}`}
          widgetId="music"
          defaultPosition={defaultPositions.music}
          disableResize
          zIndex={widgetZIndices.music || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <MusicPlayer musicState={musicState} onMusicStateChange={updateMusicState} />
          </div>
        </DraggableWidget>
      )}

      {widgetVisibility.focusprep && (
        <DraggableWidget
          key={`focusprep-${positionResetKey}`}
          widgetId="focusprep"
          defaultPosition={defaultPositions.focusprep}
          zIndex={widgetZIndices.focusprep || 10}
          onBringToFront={bringWidgetToFront}
        >
          <div style={{ opacity: settings.widgetOpacity }}>
            <FocusPrep />
          </div>
        </DraggableWidget>
      )}

      {/* Persistent YouTube Player (outside widget for continuous playback) */}
      {musicState.isPlaying && musicState.selectedStream && (
        <div className="persistent-music-player">
          <YouTubePlayer
            videoId={musicState.selectedStream.videoId}
            isPlaying={musicState.isPlaying}
            volume={musicState.volume ?? 50}
            isMuted={musicState.isMuted ?? false}
          />
        </div>
      )}

      {/* Navigation Dock */}
      <NavigationDock
        enabledWidgets={enabledWidgets}
        widgetVisibility={widgetVisibility}
        onToggleWidgetVisibility={toggleWidgetVisibility}
        onOpenSpaceBrowser={() => setShowSpaceBrowser(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Space Browser Modal */}
      {
        showSpaceBrowser && (
          <SpaceBrowser
            spaces={allSpaces}
            currentSpaceId={currentSpace.id}
            onSelectSpace={setCurrentSpace}
            onClose={() => setShowSpaceBrowser(false)}
            onAddSpace={addSpace}
            onUpdateSpace={updateSpace}
            onDeleteSpace={deleteSpace}
          />
        )
      }

      {/* Settings Panel */}
      {
        showSettings && (
          <SettingsPanel
            settings={settings}
            enabledWidgets={enabledWidgets}
            todoistConfig={todoistConfig}
            onUpdateSettings={updateSettings}
            onUpdateTodoistConfig={updateTodoistConfig}
            onToggleWidgetEnabled={toggleWidgetEnabled}
            onClose={() => setShowSettings(false)}
            onResetPositions={resetWidgetPositions}
            onDriveConnected={() => {
              // Explicitly save the type FIRST
              localStorage.setItem('focusnook-storage-type', 'gdrive');
              storage.setAdapter(googleDriveAdapter);
              setNeedsDriveAuth(false);
              loadData();
              alert("Connected! Data will sync automatically.");
            }}
          />
        )
      }

      <style>{`
        .app {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        
        .current-space {
          position: fixed;
          top: var(--space-6);
          left: var(--space-6);
          z-index: var(--z-widget);
        }
        
        .space-name {
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-text-secondary);
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          border: 1px solid var(--glass-border);
        }
        
        .clock-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: var(--z-base);
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        }
        
        .now-playing-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          border: 1px solid var(--glass-border);
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          animation: fadeIn 0.3s ease-out;
        }
        
        .now-playing-indicator svg {
          color: var(--color-accent);
        }
        
        .persistent-music-player {
          position: fixed;
          bottom: -9999px;
          left: -9999px;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
        
        .persistent-music-player iframe {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div >
  );
}

export default App;
