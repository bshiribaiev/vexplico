export type Profile =
  | 'meeting'
  | 'interview'
  | 'lecture'
  | 'presentation'
  | 'panel'
  | 'call'
  | 'hearing'
  | 'podcast'
  | 'other';

export type Status = 'queued' | 'processing' | 'completed' | 'failed';

export interface Participant {
  name: string;
  role: string;
  contribution: string;
}

export interface Topic {
  title: string;
  summary: string;
  key_points: string[];
  speakers: string[];
  start_seconds: number;
}

export interface Decision {
  item: string;
  outcome: string;
  rationale: string;
  start_seconds: number;
}

export interface ActionItem {
  task: string;
  owner: string;
  due: string;
  start_seconds: number;
}

export interface Quote {
  text: string;
  speaker: string;
  start_seconds: number;
}

export interface AdaptiveSection {
  title: string;
  items: string[];
}

export interface VideoSummary {
  profile: Profile;
  subject: string;
  one_liner: string;
  executive_summary: string;
  stated_date: string;
  topics: Topic[];
  decisions: Decision[];
  action_items: ActionItem[];
  participants: Participant[];
  open_questions: string[];
  notable_quotes: Quote[];
  adaptive_sections: AdaptiveSection[];
  overall_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface VideoListItem {
  id: string;
  title: string;
  duration_seconds: number | null;
  recorded_at: string | null;
  created_at: string;
  status: Status;
  stage: string | null;
  error_message: string | null;
  profile: Profile | null;
  one_liner: string | null;
  analyzed_at: string | null;
}

export interface VideoDetail extends VideoListItem {
  summary: VideoSummary | null;
  summary_markdown: string | null;
  transcript_chars: number | null;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
}
