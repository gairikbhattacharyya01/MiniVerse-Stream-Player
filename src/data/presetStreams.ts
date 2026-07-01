import { StreamPreset } from "../types";

export const PRESET_STREAMS: StreamPreset[] = [
  {
    name: "Big Buck Bunny (Mux Test)",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    category: "Test Feeds",
    description: "Standard high-performance HLS multi-bitrate test stream from Mux."
  },
  {
    name: "Tears of Steel (Sci-Fi Clip)",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    category: "Entertainment",
    description: "Breathtaking science-fiction cinematic clip hosted on Unified Streaming."
  },
  {
    name: "Sintel Cinematic Trailer",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    category: "Entertainment",
    description: "Open-source fantasy film Sintel, optimized for dynamic multi-bitrate streaming."
  },
  {
    name: "BipBop HTTP Classic (Mixed Content)",
    url: "http://player.vimeo.com/external/371433846.m3u8?s=231916573a19eb0310245a497063c46e01a88b3f",
    category: "Test Feeds",
    description: "Classic HLS test video served on raw HTTP. Bypasses mixed-content blocks using our server proxy!"
  },
  {
    name: "Jellyfish HLS Benchmark",
    url: "https://test-streams.mux.dev/pts_chunk/playlist.m3u8",
    category: "Test Feeds",
    description: "A specialized presentation test with precise presentation timestamps."
  },
  {
    name: "Akamai Multi-Rate Showcase",
    url: "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8",
    category: "Test Feeds",
    description: "High-resolution action footage with adaptive quality shifting."
  }
];
