export interface StreamState {
  url: string;
  title: string;
  status: "playing" | "paused" | "stopped";
  updatedAt: number;
}

export interface StreamHistoryItem {
  id: string;
  url: string;
  title: string;
  playedAt: number;
}

export interface StreamPreset {
  name: string;
  url: string;
  category: "Live News" | "Entertainment" | "Nature & Webcams" | "Test Feeds";
  description: string;
}
