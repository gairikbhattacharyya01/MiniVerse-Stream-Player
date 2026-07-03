import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { 
  Play, Pause, Volume2, VolumeX, Minimize2, Maximize2, 
  Tv, Cast, Settings, AlertTriangle, RefreshCw, Layers, Shield, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VideoPlayerProps {
  url: string;
  title: string;
  status: "playing" | "paused" | "stopped";
  isAdmin?: boolean;
  onStatusChange?: (status: "playing" | "paused" | "stopped") => void;
}

export default function VideoPlayer({ 
  url, 
  title, 
  status, 
  isAdmin = false,
  onStatusChange 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player controls state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Proxy settings
  const [forceProxy, setForceProxy] = useState(false);
  const isHttp = url.toLowerCase().startsWith("http://");
  const actualPlayUrl = (forceProxy || isHttp) 
    ? `/api/proxy?url=${encodeURIComponent(url)}` 
    : url;

  // Hls.js quality levels
  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 is Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Cast simulation & prompts
  const [showCastPrompt, setShowCastPrompt] = useState(false);
  const [castState, setCastState] = useState<"idle" | "connecting" | "connected">("idle");
  const [castDevice, setCastDevice] = useState("");

  // Control visibility (auto-hide)
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hlsRef = useRef<Hls | null>(null);

  // Check if URL is live
  useEffect(() => {
    setIsLive(url.includes("live") || url.includes("stream") || duration === Infinity || duration === 0);
  }, [url, duration]);

  // Handle active status updates from prop (for synchronized play/pause)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (status === "playing") {
      video.play().catch(() => {
        // Autoplay may be blocked; click to play is handled
      });
    } else if (status === "paused") {
      video.pause();
    } else if (status === "stopped") {
      video.pause();
      video.currentTime = 0;
    }
  }, [status]);

  // Initialize Hls or native player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMsg("");
    setQualities([]);
    setCurrentQuality(-1);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if browser supports Hls.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hlsRef.current = hls;

      hls.loadSource(actualPlayUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsLoading(false);
        const mappedQualities = data.levels.map((level, index) => ({
          id: index,
          height: level.height,
          bitrate: level.bitrate
        })).sort((a, b) => b.height - a.height); // Descending order
        setQualities(mappedQualities);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        // level switched
      });

      let networkRetryCount = 0;
      let mediaRetryCount = 0;
      const MAX_RETRIES = 3;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("Fatal HLS error:", data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCount < MAX_RETRIES) {
                networkRetryCount++;
                console.warn(`Fatal HLS network error (retry ${networkRetryCount}/${MAX_RETRIES}): trying to recover...`, data);
                hls.startLoad();
              } else {
                setHasError(true);
                setErrorMsg(`Playback failed: Persistent network error (${data.details})`);
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetryCount < MAX_RETRIES) {
                mediaRetryCount++;
                console.warn(`Fatal HLS media error (retry ${mediaRetryCount}/${MAX_RETRIES}): trying to recover...`, data);
                hls.recoverMediaError();
              } else {
                setHasError(true);
                setErrorMsg(`Playback failed: Persistent media/decoder error (${data.details})`);
                hls.destroy();
              }
              break;
            default:
              setHasError(true);
              setErrorMsg(`Playback failed: ${data.details}`);
              hls.destroy();
              break;
          }
        } else {
          // Log non-fatal errors to console.warn so they do not trigger automated fatal error alarms
          console.warn("HLS non-fatal warning:", data);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native iOS Safari support
      video.src = actualPlayUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
      });
      video.addEventListener("error", () => {
        setHasError(true);
        setErrorMsg("Native HLS stream decoding failed.");
      });
    } else {
      setIsLoading(false);
      setHasError(true);
      setErrorMsg("HLS streaming is not supported in this browser.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [actualPlayUrl]);

  // Monitor video state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (isAdmin && onStatusChange) onStatusChange("playing");
    };
    const onPause = () => {
      setIsPlaying(false);
      if (isAdmin && onStatusChange) onStatusChange("paused");
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    const onDurationChange = () => {
      setDuration(video.duration);
    };
    const onWaiting = () => {
      setIsLoading(true);
    };
    const onPlaying = () => {
      setIsLoading(false);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [isAdmin, onStatusChange]);

  // Handle auto-hiding controls
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowQualityMenu(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Sync volume state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Toggle handlers
  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => console.warn("Play interrupted:", err));
    }
    resetControlsTimeout();
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    resetControlsTimeout();
  };

  const handleVolumeSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setIsMuted(false);
    resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || isLive) return;
    const seekTo = parseFloat(e.target.value);
    video.currentTime = seekTo;
    setCurrentTime(seekTo);
    resetControlsTimeout();
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
    resetControlsTimeout();
  };

  // Monitor document fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Handle Picture-in-Picture
  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (!document.pictureInPictureElement) {
        if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          setIsPip(true);
        } else {
          alert("Picture-in-Picture mode is not supported or enabled in this browser.");
        }
      } else {
        await document.exitPictureInPicture();
        setIsPip(false);
      }
    } catch (err) {
      console.error("PiP toggle failed:", err);
    }
  };

  // Monitor PiP state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);

    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  // Handle Quality change
  const selectQuality = (levelId: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelId;
    setCurrentQuality(levelId);
    setShowQualityMenu(false);
    resetControlsTimeout();
  };

  // Format time helpers
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs === Infinity) return "0:00";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Remote Casting Handler
  const triggerCast = () => {
    const video = videoRef.current;
    if (!video) return;

    // Check if Remote Playback API is available natively (Safari, Chrome, Edge)
    if ((video as any).remote && typeof (video as any).remote.prompt === "function") {
      (video as any).remote.prompt()
        .then(() => {
          console.log("Remote playback prompt successful");
        })
        .catch((err: any) => {
          console.warn("Remote playback error or cancelled:", err);
          // Fallback to our elegant simulation prompt
          setShowCastPrompt(true);
        });
    } else {
      // Fallback directly to simulated cast pairing
      setShowCastPrompt(true);
    }
  };

  const handleSimulateCastConnect = (device: string) => {
    setCastState("connecting");
    setCastDevice(device);
    setTimeout(() => {
      setCastState("connected");
      // Pause local video since it is casting
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }, 2000);
  };

  const handleDisconnectCast = () => {
    setCastState("idle");
    setCastDevice("");
    setShowCastPrompt(false);
    // Play local video
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div 
      id="miniverse-player-container"
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-2xl border border-white/10 select-none"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        id="miniverse-main-video"
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
        onClick={handlePlayPause}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            id="player-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-none"
          >
            <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mb-3" />
            <span className="text-white font-medium text-sm tracking-wide">Buffering MiniVerse Stream...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Overlay */}
      <AnimatePresence>
        {hasError && (
          <motion.div 
            id="player-error-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 border border-red-500/20 px-6 text-center z-30"
          >
            <div className="bg-red-500/10 p-4 rounded-full border border-red-500/30 mb-4 animate-bounce">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">MiniVerse Streaming Interrupted</h3>
            <p className="text-zinc-400 text-sm max-w-md mb-6">{errorMsg || "This video stream is currently offline, protected by strict CORS headers, or unavailable."}</p>
            
            <div className="flex gap-3">
              <button
                id="btn-retry-direct"
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  if (videoRef.current) {
                    if (hlsRef.current) {
                      hlsRef.current.loadSource(actualPlayUrl);
                    } else {
                      videoRef.current.src = actualPlayUrl;
                    }
                  }
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 border border-zinc-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect
              </button>

              {!forceProxy && (
                <button
                  id="btn-enable-proxy"
                  onClick={() => {
                    setForceProxy(true);
                    setHasError(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Shield className="w-3.5 h-3.5" /> Force Secure Stream Proxy
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Casting Simulated Device Prompt Overlay */}
      <AnimatePresence>
        {showCastPrompt && (
          <motion.div 
            id="player-cast-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-30 p-6"
          >
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Cast className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <h4 className="text-white font-semibold text-sm">MiniVerse PlayOn Cast</h4>
                </div>
                <button 
                  id="btn-close-cast-prompt"
                  onClick={() => setShowCastPrompt(false)}
                  className="text-zinc-500 hover:text-white transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>

              {castState === "idle" && (
                <div>
                  <p className="text-zinc-400 text-xs mb-4">Select an active MiniVerse screen or Smart TV cast device on your network:</p>
                  <div className="space-y-2">
                    {["Living Room LG WebOS TV", "MiniVerse Theater Display 4", "Bedroom Chromecast Pro"].map((device, idx) => (
                      <button
                        id={`btn-cast-device-${idx}`}
                        key={idx}
                        onClick={() => handleSimulateCastConnect(device)}
                        className="w-full text-left p-3 bg-zinc-800 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-transparent rounded-lg text-white text-xs transition-all flex items-center justify-between"
                      >
                        <span>{device}</span>
                        <Tv className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {castState === "connecting" && (
                <div className="text-center py-6">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-3" />
                  <p className="text-white text-xs font-semibold">Broadcasting stream parameters...</p>
                  <p className="text-zinc-500 text-[10px] mt-1">Connecting to {castDevice}</p>
                </div>
              )}

              {castState === "connected" && (
                <div className="text-center py-4">
                  <div className="bg-indigo-500/15 text-indigo-400 p-4 rounded-full border border-indigo-500/20 max-w-max mx-auto mb-3">
                    <Tv className="w-10 h-10" />
                  </div>
                  <p className="text-white font-medium text-sm">Now Casting Stream</p>
                  <p className="text-zinc-400 text-xs mt-1">Playing on <span className="text-indigo-400 font-semibold">{castDevice}</span></p>
                  
                  <div className="mt-6 flex gap-2">
                    <button
                      id="btn-disconnect-cast"
                      onClick={handleDisconnectCast}
                      className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Disconnect Casting
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Casting Active Local Banner Overlay */}
      {castState === "connected" && !showCastPrompt && (
        <div id="casting-banner" className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center text-center z-10">
          <Cast className="w-16 h-16 text-indigo-500 animate-bounce mb-3" />
          <h2 className="text-white font-bold text-lg">Casting to {castDevice}</h2>
          <p className="text-zinc-400 text-xs max-w-sm mt-1">Local stream output is suspended while broadcasting parameters to the receiver screen.</p>
          <button
            id="btn-return-local-play"
            onClick={handleDisconnectCast}
            className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
          >
            Play Local Video
          </button>
        </div>
      )}

      {/* Control Overlay Bar (fades out on inactive mouse) */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            id="player-control-overlay-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40 p-4 z-10"
          >
            {/* Top Bar - Stream Title & Info */}
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold font-mono">
                  {isAdmin ? "Admin Main Output" : "Synced Stream Screen"}
                </span>
                <h4 className="text-white font-medium text-sm md:text-base tracking-wide truncate max-w-[280px] md:max-w-md drop-shadow-md">
                  {title || "Default Stream"}
                </h4>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono shadow-md animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                    LIVE
                  </span>
                )}
                {forceProxy && (
                  <span className="flex items-center gap-1 bg-indigo-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    <Shield className="w-3 h-3" /> PROXIED
                  </span>
                )}
                {isHttp && !forceProxy && (
                  <span className="flex items-center gap-1 bg-yellow-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    <ShieldAlert className="w-3 h-3" /> INSECURE (HTTP)
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Controls Area */}
            <div className="flex flex-col gap-3 w-full">
              {/* Progress Bar (Visible only if NOT LIVE and has duration) */}
              {!isLive && duration > 0 && (
                <div className="flex items-center gap-2.5 group/progress">
                  <span className="text-[10px] text-zinc-300 font-mono select-none">{formatTime(currentTime)}</span>
                  <div className="relative flex-1 flex items-center">
                    <input
                      id="progress-slider"
                      type="range"
                      min={0}
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none transition-all group-hover/progress:h-2"
                      style={{
                        background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-300 font-mono select-none">{formatTime(duration)}</span>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between w-full">
                {/* Left Controls: Play / Pause / Volume */}
                <div className="flex items-center gap-3">
                  <button
                    id="btn-play-pause-control"
                    onClick={handlePlayPause}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-200 active:scale-95 border border-white/5"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>

                  {/* Volume Slider Group */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      id="btn-mute-toggle"
                      onClick={handleMuteToggle}
                      className="p-1.5 text-zinc-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      id="volume-slider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeSlider}
                      className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-300 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Right Controls: Quality, PiP, Cast, Fullscreen */}
                <div className="flex items-center gap-1 md:gap-2 relative">
                  {/* Quality Settings Switcher (only if qualities are loaded) */}
                  {qualities.length > 0 && (
                    <div className="relative">
                      <button
                        id="btn-quality-menu"
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className={`p-2 text-zinc-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs ${showQualityMenu ? "bg-indigo-600/30 text-indigo-400" : "hover:bg-white/5"}`}
                        title="Stream Resolution"
                      >
                        <Layers className="w-4 h-4" />
                        <span className="hidden md:inline font-mono text-[10px]">
                          {currentQuality === -1 ? "Auto" : `${qualities.find(q => q.id === currentQuality)?.height}p`}
                        </span>
                      </button>

                      {/* Resolution Dropdown */}
                      <AnimatePresence>
                        {showQualityMenu && (
                          <motion.div
                            id="quality-dropdown"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-11 right-0 bg-zinc-950/95 border border-white/10 rounded-xl p-2 w-36 shadow-2xl backdrop-blur-md flex flex-col gap-1 z-40"
                          >
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider px-2 py-1 select-none">Resolution</span>
                            
                            <button
                              id="btn-quality-auto"
                              onClick={() => selectQuality(-1)}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono flex justify-between items-center ${currentQuality === -1 ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"}`}
                            >
                              <span>Auto</span>
                              <span className="text-[9px] text-zinc-400">adaptive</span>
                            </button>

                            {qualities.map((q) => (
                              <button
                                id={`btn-quality-level-${q.height}`}
                                key={q.id}
                                onClick={() => selectQuality(q.id)}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono flex justify-between items-center ${currentQuality === q.id ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"}`}
                              >
                                <span>{q.height}p</span>
                                <span className="text-[9px] text-zinc-500">{(q.bitrate / 1000000).toFixed(1)} Mbps</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Secure Proxy Toggle (manual) */}
                  <button
                    id="btn-toggle-proxy-manual"
                    onClick={() => {
                      setForceProxy(!forceProxy);
                      resetControlsTimeout();
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all ${forceProxy ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20" : "text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent"}`}
                    title={forceProxy ? "Proxy play active" : "Play direct (No Proxy)"}
                  >
                    <Shield className="w-4 h-4" />
                  </button>

                  {/* Picture in Picture Button */}
                  <button
                    id="btn-pip"
                    onClick={togglePip}
                    className="hidden sm:inline-flex p-2 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Picture-in-Picture Mode"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>

                  {/* Chromecast / Casting Device Button */}
                  <button
                    id="btn-cast"
                    onClick={triggerCast}
                    className="p-1.5 sm:p-2 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Cast Stream Screen"
                  >
                    <Cast className="w-4 h-4" />
                  </button>

                  {/* Fullscreen Button */}
                  <button
                    id="btn-fullscreen"
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
