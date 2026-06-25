export type ISODateString = string;
export type UserId = string;
export type VideoId = string;
export type SubscriptionTier = 'free' | 'premium' | 'creator';
export type Language = 'en' | 'am' | 'ar' | 'fr' | 'es' | 'pt' | 'hi' | 'zh' | 'sw' | 'de' | 'ru' | 'tr' | 'ja' | 'ko' | 'it';
export type Theme = 'dark' | 'light';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface UserProfile {
  id: UserId;
  username: string;
  fullName: string;
  email: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string;
  link: string;
  verified: boolean;
  followers: UserId[];
  following: UserId[];
  blockedUsers: UserId[];
  coins: number;
  walletBalance: number;
  level: number;
  streak: number;
  subscription: SubscriptionTier;
  language: Language;
  theme: Theme;
  createdAt: ISODateString;
}

export interface VideoPost {
  id: VideoId;
  userId: UserId;
  username: string;
  userAvatar: string;
  userAvatarColor: string;
  userAvatarUrl: string | null;
  userVerified: boolean;
  media: { kind: 'video' | 'image'; url: string };
  images?: string[];
  description: string;
  hashtags: string[];
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationFlags?: string[];
  song?: string;
  visibility: 'public' | 'followers' | 'private';
  likes: number;
  comments: number;
  shares: number;
  views: number;
  trendingScore: number;
  createdAt: ISODateString;
}

export interface Comment {
  id: string;
  videoId: VideoId;
  userId: UserId;
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  text: string;
  likes: number;
  pinned: boolean;
  createdAt: ISODateString;
}

export interface ModerationVerdict {
  safe: boolean;
  toxicityScore: number;
  nsfwScore: number;
  spamScore: number;
  flags: string[];
  reason?: string;
}

export interface SmartCaptionResult {
  caption: string;
  hashtags: string[];
  detectedLanguage: Language;
}

export interface TrendingTopic {
  tag: string;
  growth: number;
  posts: number;
}

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';
export interface ToastItem { id: string; message: string; variant: ToastVariant; }
export type AppPage = 'feed' | 'discover' | 'inbox' | 'profile' | 'create';
