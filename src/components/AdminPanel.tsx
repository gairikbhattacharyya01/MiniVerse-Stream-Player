import React, { useState, useEffect } from "react";
import { 
  Play, Pause, Square, Link, Video, History, Plus, CheckCircle, 
  Trash2, Shield, Lock, Unlock, HelpCircle, Layers, RefreshCw
} from "lucide-react";
import { PRESET_STREAMS } from "../data/presetStreams";
import { StreamHistoryItem, StreamPreset } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  currentUrl: string;
  currentTitle: string;
  currentStatus: "playing" | "paused" | "stopped";
  onDispatchStream: (url: string, title: string, status?: "playing" | "paused" | "stopped") => Promise<void>;
  onTriggerSyncAction: (status: "playing" | "paused" | "stopped") => Promise<void>;
}

export default function AdminPanel({
  currentUrl,
  currentTitle,
  currentStatus,
  onDispatchStream,
  onTriggerSyncAction
}: AdminPanelProps) {
  // Authorization
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const defaultPin = "060840";

  // Dispatch inputs
  const [streamUrl, setStreamUrl] = useState("");
  const [streamTitle, setStreamTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successAlert, setSuccessAlert] = useState("");
  const [errorAlert, setErrorAlert] = useState("");

  // History state
  const [history, setHistory] = useState<StreamHistoryItem[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("miniverse_stream_history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load stream history:", e);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: StreamHistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("miniverse_stream_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save stream history:", e);
    }
  };

  const handleUnlockAdmin = (e: React.FormEvent) => {
     e.preventDefault();
     if (pinInput === defaultPin) {
       setIsAdminUnlocked(true);
       setPinInput("");
       setPinError("");
     } else {
       setPinError("Invalid Security PIN. Access Denied.");
     }
   };

  const handleDispatch = async (urlStr: string, titleStr: string, autoPlayStatus: "playing" | "paused" | "stopped" = "playing") => {
    if (!urlStr) {
      setErrorAlert("Please specify a stream URL");
      return;
    }

    const trimmedUrl = urlStr.trim();
    if (!trimmedUrl.toLowerCase().includes(".m3u8") && !trimmedUrl.toLowerCase().includes("stream") && !trimmedUrl.toLowerCase().includes("live")) {
      setErrorAlert("Warning: Stream URL might not be a valid HLS (.m3u8) format.");
    }

    setIsSubmitting(true);
    setErrorAlert("");
    setSuccessAlert("");

    try {
      const finalTitle = (titleStr || `Stream - ${new URL(trimmedUrl).hostname}`).trim();
      await onDispatchStream(trimmedUrl, finalTitle, autoPlayStatus);
      
      // Add to local history list
      const newItem: StreamHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        url: trimmedUrl,
        title: finalTitle,
        playedAt: Date.now()
      };

      // De-duplicate URLs in history
      const filteredHistory = history.filter(item => item.url.toLowerCase() !== trimmedUrl.toLowerCase());
      saveHistory([newItem, ...filteredHistory].slice(0, 10)); // Keep top 10 items

      setSuccessAlert("Stream successfully dispatched to all active users!");
      setTimeout(() => setSuccessAlert(""), 4000);
    } catch (error: any) {
      setErrorAlert(`Dispatch failed: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDispatch(streamUrl, streamTitle);
    setStreamUrl("");
    setStreamTitle("");
  };

  const handleSelectPreset = (preset: StreamPreset) => {
    setStreamUrl(preset.url);
    setStreamTitle(preset.name);
    // Auto-scroll to form top
    document.getElementById("dispatch-form-title")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

  const handleRemoveHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering play
    saveHistory(history.filter(item => item.id !== id));
  };

  return (
    <div id="admin-panel-container" className="bg-[#080808] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Decorative accent glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -z-10" />

      {/* Access Gate */}
      <AnimatePresence mode="wait">
        {!isAdminUnlocked ? (
          <motion.div
            key="lock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10"
          >
            <div className="p-4 bg-indigo-600/10 text-indigo-400 rounded-full border border-indigo-500/20 mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-white text-base font-semibold font-display tracking-tight mb-2">Admin Panel Gate</h3>
            <p className="text-zinc-400 text-xs text-center max-w-xs mb-6 leading-relaxed">
              Unlock dispatch console to play streams, control viewer timelines, and access stream history.
            </p>

            <form onSubmit={handleUnlockAdmin} className="w-full max-w-xs flex flex-col gap-4">
              <div className="relative">
                <input
                  id="admin-pin-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Security PIN"
                  className="w-full px-4 py-3.5 bg-[#121212] border border-white/10 rounded-xl text-white text-base text-center placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors tracking-widest font-mono shadow-inner"
                />
                {pinError && (
                  <p id="pin-error-text" className="text-red-400 text-[11px] mt-2 text-center font-medium font-mono">{pinError}</p>
                )}
              </div>

              <button
                id="btn-unlock-admin"
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-600/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" /> Unlock Dispatch Console
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="console"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Unlocked Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-white text-sm font-semibold tracking-wide font-display">MiniVerse Admin Console</span>
              </div>
              <button
                id="btn-lock-admin"
                onClick={() => setIsAdminUnlocked(false)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 cursor-pointer"
              >
                Lock Controls
              </button>
            </div>

            {/* Broadcast Control Suite (Play, Pause, Stop for everyone) */}
            <div className="bg-[#121212]/90 rounded-xl p-4 border border-white/10 shadow-inner">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Live Timeline Sync</span>
              <h4 className="text-white font-medium text-xs mt-1 mb-3">Sync play/pause states across all users in real-time:</h4>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <button
                  id="btn-admin-broadcast-play"
                  onClick={() => onTriggerSyncAction("playing")}
                  className={`py-2.5 sm:py-3 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${currentStatus === "playing" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/15" : "bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5"}`}
                >
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" /> Play
                </button>
                
                <button
                  id="btn-admin-broadcast-pause"
                  onClick={() => onTriggerSyncAction("paused")}
                  className={`py-2.5 sm:py-3 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${currentStatus === "paused" ? "bg-amber-600 text-white shadow-lg shadow-amber-600/15" : "bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5"}`}
                >
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" /> Pause
                </button>

                <button
                  id="btn-admin-broadcast-stop"
                  onClick={() => onTriggerSyncAction("stopped")}
                  className={`py-2.5 sm:py-3 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${currentStatus === "stopped" ? "bg-red-600 text-white shadow-lg shadow-red-600/15" : "bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5"}`}
                >
                  <Square className="w-3.5 h-3.5 fill-current shrink-0" /> Stop
                </button>
              </div>
            </div>

            {/* Dispatch Form */}
            <form onSubmit={handleDispatchSubmit} className="flex flex-col gap-4">
              <div id="dispatch-form-title" className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Dispatch New m3u8</span>
                <HelpCircle className="w-3.5 h-3.5 text-zinc-500 cursor-help" title="Paste any direct HLS stream link. Cross-origin security policies and protocol differences are automatically bypassed." />
              </div>

              <div className="flex flex-col gap-3">
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Link className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-dispatch-url"
                    type="text"
                    required
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="Enter HLS Link (e.g. https://.../playlist.m3u8)"
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600 font-mono shadow-inner"
                  />
                </div>

                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Video className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-dispatch-title"
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    placeholder="Stream Title (optional, e.g. Earth Cam Live)"
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600 shadow-inner"
                  />
                </div>
              </div>

              {/* Status Alert logs */}
              {successAlert && (
                <div id="admin-success-toast" className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-3 rounded-xl font-mono">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successAlert}</span>
                </div>
              )}
              {errorAlert && (
                <div id="admin-error-toast" className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-3 rounded-xl font-mono">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>{errorAlert}</span>
                </div>
              )}

              <button
                id="btn-dispatch-stream"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Distributing stream parameters...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Dispatch Active Stream URL
                  </>
                )}
              </button>
            </form>

            {/* Presets and History Tabs */}
            <div className="border-t border-white/5 pt-5 flex flex-col gap-4">
              <div>
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Stream Presets</span>
                <p className="text-zinc-500 text-[10px] mt-0.5 mb-2 leading-relaxed">Fast-track demonstration loops loaded onto the player.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {PRESET_STREAMS.map((preset, idx) => (
                    <button
                      id={`btn-select-preset-${idx}`}
                      key={idx}
                      onClick={() => handleSelectPreset(preset)}
                      className="text-left p-2.5 bg-[#121212] hover:bg-indigo-600/5 border border-white/10 hover:border-indigo-500/30 rounded-xl transition-all group flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-white text-xs font-medium group-hover:text-indigo-400 transition-colors truncate max-w-[120px] font-display">{preset.name}</span>
                        <span className="text-[8px] px-1.5 py-0.5 bg-white/5 text-zinc-400 rounded border border-white/5 font-mono font-bold uppercase">{preset.category}</span>
                      </div>
                      <p className="text-zinc-500 text-[9px] line-clamp-1 leading-relaxed">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* History list */}
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Stream Dispatch History</span>
                    <button
                      id="btn-clear-history"
                      onClick={handleClearHistory}
                      className="text-[9px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors bg-white/5 px-2 py-0.5 rounded border border-white/5 cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Clear History
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {history.map((item, idx) => (
                      <div
                        id={`history-row-${idx}`}
                        key={item.id}
                        onClick={() => handleDispatch(item.url, item.title)}
                        className="p-2 bg-[#121212]/50 hover:bg-indigo-600/10 border border-white/10 hover:border-indigo-500/20 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex flex-col gap-0.5 truncate pr-2">
                          <span className="text-zinc-300 text-xs font-medium truncate group-hover:text-indigo-300 transition-colors font-display">{item.title}</span>
                          <span className="text-[9px] text-zinc-600 font-mono truncate">{item.url}</span>
                        </div>
                        <button
                          id={`btn-delete-history-item-${idx}`}
                          onClick={(e) => handleRemoveHistoryItem(item.id, e)}
                          className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
