/**
 * Core domain types for Dagu V5.
 * Migrated from the original JSX file's implicit shapes, with:
 *  - explicit nullable fields
 *  - strict union types for status enums
 *  - discriminated unions for media variants
 *  - ISO date strings (instead of Firestore Timestamps leaking through the UI)
 *
 * Firestore-specific Timestamp conversion happens at the service boundary,
 * keeping components free of SDK coupling.
 */

export type ISODateString = string;
export type UserId = string;
export type VideoId = string;
export type CommentId = string;

/* ─────────────── User ─────────────── */

export type SubscriptionTier = 'free' | 'premium' | 'creator';
export type Language =
  | 'en' | 'am' | 'ar' | 'fr' | 'es' | 'pt' | 'hi' | 'zh'
  | 'sw' | 'de' | 'ru' | 'tr' | 'ja' | 'ko' | 'it';
export type Theme = 'dark' | 'light';

export interface UserProfile {
  id: UserId;
  username: string;
  fullName: string;
  email: string;
  avatar: string;          // First letter / emoji fallback
  avatarColor: string;     // hsl() string for avatar background
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

export interface PublicUserProfile
  extends Pick<UserProfile,
    | 'id' | 'username' | 'fullName' | 'avatar' | 'avatarColor' | 'avatarUrl'
    | 'bio' | 'verified' | 'followers' | 'following' | 'level'
    | 'subscription'
  > {}

/* ─────────────── Media ─────────────── */

export type MediaKind = 'video' | 'image' | 'audio';

interface BaseMedia {
  url: string;
  durationSec?: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface VideoMedia extends BaseMedia {
  kind: 'video';
}
export interface ImageMedia extends BaseMedia {
  kind: 'image';
}
export interface AudioMedia extends BaseMedia {
  kind: 'audio';
}

export type Media = VideoMedia | ImageMedia | AudioMedia;

/* ─────────────── Video / Post ─────────────── */

export type VideoVisibility = 'public' | 'followers' | 'private';

export interface PollOption {
  text: string;
  votes: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
  voters: Record<UserId, number>; // userId → optionIdx
  closesAt?: ISODateString;
}

export interface VideoPost {
  id: VideoId;
  userId: UserId;
  username: string;
  userAvatar: string;
  userAvatarColor: string;
  userAvatarUrl: string | null;
  userVerified: boolean;
  media: Media;
  /** Multi-image carousel support (preserved from V3) */
  images?: string[];
  description: string;
  /** Pre-generated hashtags extracted by the smart AI service */
  hashtags: string[];
  /** Auto-detected language code of the caption */
  detectedLanguage?: Language;
  /** Smart-moderation verdict — blocks publishing of unsafe content */
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationFlags?: string[];
  song?: string;
  visibility: VideoVisibility;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  /** Personalization score used by the smart feed ranker */
  trendingScore: number;
  poll?: Poll;
  /** Soft-delete: posts are kept but hidden from feeds */
  deletedAt?: ISODateString | null;
  createdAt: ISODateString;
}

/* ─────────────── Comment ─────────────── */

export interface Comment {
  id: CommentId;
  videoId: VideoId;
  userId: UserId;
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  text: string;
  /** Optional voice note / image attached to the comment */
  mediaUrl?: string;
  mediaType?: MediaKind;
  likes: number;
  parentId?: CommentId; // threaded replies
  pinned: boolean;
  /** Toxicity score from the moderation service (0..1) */
  toxicityScore?: number;
  createdAt: ISODateString;
}

/* ─────────────── Chat ─────────────── */

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  id: string;
  senderId: UserId;
  receiverId: UserId;
  text: string;
  mediaUrl?: string;
  mediaType?: MediaKind;
  status: MessageStatus;
  /** Smart-reply suggestions generated for this message */
  replySuggestions?: string[];
  createdAt: ISODateString;
}

/* ─────────────── Story ─────────────── */

export interface Story {
  id: string;
  userId: UserId;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  text?: string;
  bgColor?: string;
  mediaUrl?: string | null;
  mediaType?: MediaKind;
  seenBy: UserId[];
  createdAt: ISODateString;
  expiresAt: ISODateString;
}

/* ─────────────── Notifications ─────────────── */

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'gift'
  | 'live'
  | 'call'
  | 'permissionRequest'
  | 'reviewFlag';

export interface AppNotification {
  id: string;
  toUserId: UserId;
  fromUserId: UserId;
  type: NotificationType;
  message: string;
  read: boolean;
  videoId?: VideoId;
  createdAt: ISODateString;
}

/* ─────────────── Marketplace / Jobs ─────────────── */

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship' | 'Remote';
export type MarketCondition = 'New' | 'Like New' | 'Good' | 'Fair';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface JobListing {
  id: string;
  userId: UserId;
  title: string;
  company: string;
  location: string;
  type: JobType;
  salary: string;
  description: string;
  skills: string[];
  contactEmail: string;
  applicantCount: number;
  reviewStatus: ReviewStatus;
  moderationFlags?: string[];
  createdAt: ISODateString;
}

export interface MarketListing {
  id: string;
  userId: UserId;
  title: string;
  category: string;
  price: string;
  description: string;
  condition: MarketCondition;
  tags: string[];
  contactEmail: string;
  reviewStatus: ReviewStatus;
  moderationFlags?: string[];
  createdAt: ISODateString;
}

/* ─────────────── AI / Smart Service Payloads ─────────────── */

export interface ModerationVerdict {
  safe: boolean;
  toxicityScore: number;       // 0..1
  nsfwScore: number;           // 0..1
  spamScore: number;           // 0..1
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
  growth: number; // % growth over last 24h
  posts: number;
}
