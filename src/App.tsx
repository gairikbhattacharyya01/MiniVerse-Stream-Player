import React, { useState, useEffect } from "react";
import { 
  Tv, Radio, Shield, HelpCircle, Laptop, Wifi, ExternalLink, Sparkles, RefreshCw
} from "lucide-react";
import { StreamState } from "./types";
import AdminPanel from "./components/AdminPanel";
import UserViewer from "./components/UserViewer";
import VideoPlayer from "./components/VideoPlayer";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"viewer" | "admin">("viewer");
  const [streamState, setStreamState] = useState<StreamState>({
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    title: "Mux Big Buck Bunny (Default Test)",
    status: "playing",
    updatedAt: Date.now()
  });

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [reconnectToken, setReconnectToken] = useState(0);

  // Subscribe to real-time stream parameters from Express backend via Server-Sent Events (SSE)
  useEffect(() => {
    setConnectionStatus("connecting");
    const eventSource = new EventSource("/api/stream/live");

    eventSource.onopen = () => {
      setConnectionStatus("connected");
    };

    eventSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data) as StreamState;
        setStreamState(state);
      } catch (err) {
        console.error("Failed to parse stream broadcast parameters:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE feed offline, attempting reconnect...", err);
      setConnectionStatus("disconnected");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [reconnectToken]);

  const handleReconnect = () => {
    setReconnectToken(prev => prev + 1);
  };

  // Dispatch a new stream URL and Title to all connected users
  const handleDispatchStream = async (url: string, title: string, status: "playing" | "paused" | "stopped" = "playing") => {
    const res = await fetch("/api/stream/set", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url, title, status })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to set active stream");
    }

    const data = await res.json();
    setStreamState(data.state);
  };

  // Trigger a playback sync action (Play, Pause, Stop) for all users
  const handleTriggerSyncAction = async (status: "playing" | "paused" | "stopped") => {
    await handleDispatchStream(streamState.url, streamState.title, status);
  };

  return (
    <div id="miniverse-app" className="min-h-screen bg-[#050505] text-[#E0E0E0] font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Sophisticated Dark gradient glow accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-indigo-500/5 to-purple-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-6 py-6 md:py-10 flex flex-col gap-6 md:gap-8">
        
        {/* Navigation / Brand Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/5 pb-6 bg-[#080808]/80 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/5">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Tv className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-lg md:text-xl tracking-tight text-white">
                  MiniVerse<span className="text-indigo-400 font-medium ml-1">Video</span>
                </h1>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-widest font-mono">
                  Live Engine
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-0.5">Real-time synchronized theater stream networks.</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#121212] border border-white/10 p-1.5 rounded-xl shadow-inner">
            <button
              id="btn-tab-viewer"
              onClick={() => setActiveTab("viewer")}
              className={`px-4.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${activeTab === "viewer" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-400 hover:text-white"}`}
            >
              <Laptop className="w-3.5 h-3.5" /> Theater Viewer
            </button>
            <button
              id="btn-tab-admin"
              onClick={() => setActiveTab("admin")}
              className={`px-4.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${activeTab === "admin" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-400 hover:text-white"}`}
            >
              <Radio className="w-3.5 h-3.5" /> Broadcast Console
            </button>
          </div>
        </header>

        {/* Global Connection Warning Banner */}
        {connectionStatus === "disconnected" && (
          <div id="global-connection-error" className="bg-red-950/40 border border-red-500/10 rounded-xl p-4 flex items-center justify-between text-xs text-red-400">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500 animate-pulse" />
              <span>Real-time MiniVerse sync network is currently offline. Your timeline playhead is unlinked.</span>
            </div>
            <button 
              id="btn-reconnect-global-alert"
              onClick={handleReconnect}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-red-600/20"
            >
              <RefreshCw className="w-3 h-3 animate-spin" /> Force Reconnect
            </button>
          </div>
        )}

        {/* Dynamic Screen View */}
        <main className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === "viewer" ? (
              <motion.div
                id="view-viewer-mode"
                key="viewer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Primary user player view */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <UserViewer
                      streamState={streamState}
                      connectionStatus={connectionStatus}
                      onReconnect={handleReconnect}
                    />
                  </div>

                  {/* Sidebar Info/Guide */}
                  <div className="flex flex-col gap-6">
                    {/* Welcome Card */}
                    <div className="bg-[#080808] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
                      <div className="flex items-center gap-2 text-indigo-400 mb-3">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Theater Guide</span>
                      </div>
                      <h3 className="text-white text-base font-semibold tracking-tight font-display mb-2">Welcome to the MiniVerse Theater</h3>
                      <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                        This is the customized watch face. An admin manages the live stream parameters from the Broadcast Console. When they switch tracks, play, or pause, your player updates natively!
                      </p>
                      
                      <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded font-mono font-bold text-[9px] w-5 text-center mt-0.5 border border-indigo-500/20">1</span>
                          <p className="text-zinc-500 text-[11px] leading-relaxed">
                            Open this application in <strong className="text-zinc-300">multiple browser windows</strong> to observe the instant synchronized playhead state!
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded font-mono font-bold text-[9px] w-5 text-center mt-0.5 border border-indigo-500/20">2</span>
                          <p className="text-zinc-500 text-[11px] leading-relaxed">
                            Toggle <strong className="text-zinc-300">Broadcast Console</strong> at the top right to act as the theater director!
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded font-mono font-bold text-[9px] w-5 text-center mt-0.5 border border-indigo-500/20">3</span>
                          <p className="text-zinc-500 text-[11px] leading-relaxed">
                            The custom player uses a server-side proxy which lets you load and stream CORS-locked or HTTP links on our HTTPS platform flawlessly!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stream specs diagnostics banner */}
                    <div className="bg-[#0c0c0c] border border-white/5 rounded-2xl p-6 shadow-md">
                      <h4 className="text-white font-semibold font-display text-xs mb-3">Streaming Engine Details</h4>
                      <div className="space-y-3 font-mono text-[11px]">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-zinc-500">Codec Decoders</span>
                          <span className="text-zinc-300">H.264 / AAC Audio</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-zinc-500">HTML5 MSE Support</span>
                          <span className="text-zinc-300">hls.js Active</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-zinc-500">Chromecast Bridge</span>
                          <span className="text-zinc-300">RemotePlayback API</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CORS Proxy Port</span>
                          <span className="text-zinc-300">3000 (Active)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                id="view-admin-mode"
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left monitor display player */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">Admin Monitor Display</span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Synchronous Loop
                        </span>
                      </div>
                      
                      <VideoPlayer
                        url={streamState.url}
                        title={streamState.title}
                        status={streamState.status}
                        isAdmin={true}
                        onStatusChange={handleTriggerSyncAction}
                      />
                    </div>

                    {/* Quick helper for custom streams */}
                    <div className="bg-[#080808] border border-white/10 rounded-2xl p-6 shadow-lg">
                      <h4 className="text-white font-semibold text-xs mb-2 flex items-center gap-1.5 font-display">
                        <HelpCircle className="w-4 h-4 text-indigo-400" /> Casting & Picture-in-Picture instructions
                      </h4>
                      <p className="text-zinc-400 text-xs leading-relaxed">
                        To test **Picture-in-Picture** or **Casting**, click the dedicated buttons on the bottom right corner of the video player control bar:
                      </p>
                      <ul className="list-disc list-inside text-zinc-500 text-xs mt-2.5 space-y-1">
                        <li><strong className="text-zinc-300">Picture-in-Picture:</strong> detaches the stream screen into a floating overlay that hovers over your other browser tabs seamlessly.</li>
                        <li><strong className="text-zinc-300">Casting:</strong> initiates standard Remote Playback API triggers to connect to smart devices on your local network. It also offers a fully styled mock pairing dialog for demo verification!</li>
                      </ul>
                    </div>
                  </div>

                  {/* Right dispatcher form panel */}
                  <div>
                    <AdminPanel
                      currentUrl={streamState.url}
                      currentTitle={streamState.title}
                      currentStatus={streamState.status}
                      onDispatchStream={handleDispatchStream}
                      onTriggerSyncAction={handleTriggerSyncAction}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Global Footer */}
        <footer className="mt-8 pt-6 border-t border-white/5 text-center text-zinc-600 text-xs">
          <p>MiniVerse Video Player &copy; 2026. Custom streaming engines powered by hls.js & Express stream proxy.</p>
        </footer>
      </div>
    </div>
  );
}
