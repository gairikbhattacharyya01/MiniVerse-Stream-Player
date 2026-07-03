import React, { useState, useEffect } from "react";
import { Tv, Radio, RefreshCw, Zap, ShieldAlert, Wifi, Flame, Heart, Sparkles, Smile } from "lucide-react";
import VideoPlayer from "./VideoPlayer";
import { StreamState } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface UserViewerProps {
  streamState: StreamState;
  connectionStatus: "connecting" | "connected" | "disconnected";
  onReconnect: () => void;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

export default function UserViewer({
  streamState,
  connectionStatus,
  onReconnect
}: UserViewerProps) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  // Trigger floating reaction animation
  const handleTriggerReaction = (emoji: string) => {
    const newReaction: FloatingReaction = {
      id: Math.random().toString(36).substring(2, 9),
      emoji,
      left: 10 + Math.random() * 80 // random percentage across the video screen width
    };
    setReactions(prev => [...prev, newReaction]);

    // Cleanup after animation completes
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2500);
  };

  return (
    <div id="user-viewer-container" className="flex flex-col gap-6">
      {/* Video Stream Stage */}
      <div className="relative">
        <VideoPlayer
          url={streamState.url}
          title={streamState.title}
          status={streamState.status}
        />

        {/* Floating Reactions Overlay inside the video player stage */}
        <div id="floating-reactions-overlay" className="absolute bottom-16 inset-x-0 h-48 pointer-events-none overflow-hidden z-10">
          <AnimatePresence>
            {reactions.map(r => (
              <motion.span
                id={`reaction-${r.id}`}
                key={r.id}
                initial={{ opacity: 0, y: 150, scale: 0.5 }}
                animate={{ 
                  opacity: [0, 1, 1, 0], 
                  y: -50, 
                  scale: [0.5, 1.2, 1, 0.8],
                  x: [0, Math.sin(parseFloat(r.id)) * 30, 0] // winding path
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, ease: "easeOut" }}
                className="absolute text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] select-none pointer-events-none"
                style={{ left: `${r.left}%` }}
              >
                {r.emoji}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sync State & Diagnostic Info Card */}
      <div className="bg-[#080808] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-white font-semibold font-display text-sm tracking-tight">MiniVerse Synchronization Engine</h4>
                <AnimatePresence mode="wait">
                  {connectionStatus === "connected" && (
                    <motion.span 
                      key="conn-ok"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold tracking-wide uppercase"
                    >
                      <Wifi className="w-2.5 h-2.5 animate-pulse" /> Synced
                    </motion.span>
                  )}
                  {connectionStatus === "connecting" && (
                    <motion.span 
                      key="conn-trying"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-bold tracking-wide uppercase"
                    >
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching
                    </motion.span>
                  )}
                  {connectionStatus === "disconnected" && (
                    <motion.span 
                      key="conn-err"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 font-bold tracking-wide uppercase"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" /> Offline
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>

          {/* Diagnostic reconnection control */}
          {connectionStatus === "disconnected" && (
            <button
              id="btn-reconnect-sse"
              onClick={onReconnect}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              <Zap className="w-3.5 h-3.5" /> Reconnect Sync Feed
            </button>
          )}
        </div>

        {/* Live Reaction Tray */}
        <div className="border-t border-white/5 mt-5 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-center md:text-left">
          <div className="flex flex-col gap-0.5">
            <span className="text-zinc-200 text-xs font-semibold font-display">Broadcast Reactions</span>
            <span className="text-zinc-500 text-[10px]">Send real-time reaction visualizers across the theater:</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-2.5">
            {[
              { emoji: "🔥", label: "Flame" },
              { emoji: "❤️", label: "Love" },
              { emoji: "👏", label: "Applause" },
              { emoji: "😮", label: "Wow" },
              { emoji: "😂", label: "Laugh" }
            ].map((react, idx) => (
              <button
                id={`btn-react-emoji-${idx}`}
                key={idx}
                onClick={() => handleTriggerReaction(react.emoji)}
                className="w-10 h-10 rounded-xl bg-[#121212] border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 active:scale-90 text-xl flex items-center justify-center transition-all duration-150 relative group shadow-sm"
                title={react.label}
              >
                <span>{react.emoji}</span>
                <span className="absolute -top-7 scale-0 group-hover:scale-100 bg-[#121212] text-white text-[9px] px-1.5 py-0.5 rounded border border-white/10 transition-transform pointer-events-none whitespace-nowrap">
                  {react.label}
                </span>
              </button>
            ))}
          </div>
        </div>


      </div>
    </div>
  );
}
