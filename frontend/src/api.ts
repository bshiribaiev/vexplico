import type { Transcript, VideoDetail, VideoListItem } from './types/summary';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  return response.json();
}

export interface Health {
  database: boolean;
  ffmpeg: boolean;
  transcription: boolean;
  analysis: boolean;
}

export const api = {
  health: () => request<Health>('/health'),

  listVideos: (query: string, profile: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (profile) params.set('profile', profile);
    return request<{ videos: VideoListItem[]; count: number }>(`/api/videos?${params}`);
  },

  getVideo: (id: string) => request<VideoDetail>(`/api/videos/${id}`),

  getTranscript: (id: string) => request<Transcript>(`/api/videos/${id}/transcript`),

  submitFile: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ id: string; title: string }>('/api/videos', { method: 'POST', body });
  },

  reprocess: (id: string) => request<{ id: string }>(`/api/videos/${id}/reprocess`, { method: 'POST' }),

  deleteVideo: (id: string) => request<{ id: string }>(`/api/videos/${id}`, { method: 'DELETE' }),
};
