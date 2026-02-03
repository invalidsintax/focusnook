import { useEffect, useRef } from 'react';

export default function YouTubePlayer({ videoId, isPlaying, volume, isMuted, onStateChange }) {
    const playerRef = useRef(null);
    const containerRef = useRef(null);

    // Initialize player
    useEffect(() => {
        if (!window.YT) {
            // Load YouTube IFrame API if not already loaded
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                initializePlayer();
            };
        } else {
            initializePlayer();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle videoId changes
    useEffect(() => {
        if (playerRef.current && playerRef.current.loadVideoById && videoId) {
            playerRef.current.loadVideoById(videoId);
        }
    }, [videoId]);

    // Handle playing state
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
            const state = playerRef.current.getPlayerState();
            if (isPlaying && state !== window.YT.PlayerState.PLAYING) {
                playerRef.current.playVideo();
            } else if (!isPlaying && state === window.YT.PlayerState.PLAYING) {
                playerRef.current.pauseVideo();
            }
        }
    }, [isPlaying]);

    // Handle volume changes
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
            playerRef.current.setVolume(volume);
        }
    }, [volume]);

    // Handle mute changes
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.mute === 'function') {
            if (isMuted) {
                playerRef.current.mute();
            } else {
                playerRef.current.unMute();
            }
        }
    }, [isMuted]);

    const initializePlayer = () => {
        if (playerRef.current) return; // Already initialized

        // Ensure container exists
        if (!document.getElementById('youtube-player-mount')) return;

        playerRef.current = new window.YT.Player('youtube-player-mount', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'iv_load_policy': 3,
                'modestbranding': 1,
                'rel': 0,
                'showinfo': 0,
                'autoplay': isPlaying ? 1 : 0,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    };

    const onPlayerReady = (event) => {
        // Apply initial settings
        event.target.setVolume(volume);
        if (isMuted) {
            event.target.mute();
        } else {
            event.target.unMute();
        }

        if (isPlaying) {
            event.target.playVideo();
        }
    };

    const onPlayerStateChange = (event) => {
        // Optional: sync state back to parent if needed
        // 0 = ended, 1 = playing, 2 = paused
        if (onStateChange) onStateChange(event.data);
    };

    return (
        <div ref={containerRef} className="youtube-player-container">
            <div id="youtube-player-mount"></div>
            <style>{`
            .youtube-player-container {
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
        `}</style>
        </div>
    );
}
