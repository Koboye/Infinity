// DaguV3.jsx — COMPLETE REDESIGN TO MATCH IMAGE
'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ============================================================
// 1. DESIGN SYSTEM
// ============================================================
const COLORS = {
  primary: '#FF2156',
  primaryDark: '#E01A4A',
  primaryLight: '#FF6B8A',
  secondary: '#9D4EDD',
  secondaryLight: '#C084FC',
  accent: '#0A84FF',
  accentLight: '#4BA0FF',
  success: '#2ED573',
  warning: '#FFB100',
  danger: '#FF2156',
  gradient1: 'linear-gradient(135deg, #FF2156, #9D4EDD)',
  gradient2: 'linear-gradient(135deg, #FF2156, #FFB100)',
  gradient3: 'linear-gradient(135deg, #9D4EDD, #0A84FF)',
  bg: '#0B0B0F',
  bgSecondary: '#15151C',
  bgElevated: '#1C1C24',
  bgCard: '#24242E',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.04)',
  borderActive: 'rgba(255,45,85,0.3)',
  shadow: '0 8px 32px rgba(0,0,0,0.4)',
  shadowGlow: '0 0 40px rgba(255,45,85,0.15)',
};

const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: 800, lineHeight: 1.2 },
  h2: { fontSize: 24, fontWeight: 700, lineHeight: 1.3 },
  h3: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
  h4: { fontSize: 17, fontWeight: 600, lineHeight: 1.4 },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  caption: { fontSize: 11, fontWeight: 500, lineHeight: 1.3 },
};

// ============================================================
// 2. FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a",
  measurementId: "G-KJW3QQJ26X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Cloudinary Config
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const timeAgo = (date) => {
  if (!date) return 'just now';
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(date).toLocaleDateString();
};

const uploadToCloudinary = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD);
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    xhr.open('POST', CLOUDINARY_UPLOAD_URL);
    xhr.send(formData);
  });
};

// ============================================================
// 4. STORIES COMPONENT
// ============================================================
const StoriesBar = ({ stories, currentUser, onStoryPress, onCreateStory }) => {
  return (
    <div style={{
      padding: '12px 16px',
      background: 'transparent',
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{
          color: COLORS.text,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.3,
        }}>Stories</span>
        <button style={{
          background: 'none',
          border: 'none',
          color: COLORS.textSecondary,
          fontSize: 13,
          cursor: 'pointer',
        }}>See All</button>
      </div>
      
      <div style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {/* Create Story */}
        <div 
          onClick={onCreateStory}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: COLORS.gradient1,
            padding: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: COLORS.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 20, color: COLORS.text, fontWeight: 700 }}>
                  {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
              <div style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: COLORS.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${COLORS.bg}`,
                fontSize: 12,
                color: 'white',
                fontWeight: 700,
              }}>+</div>
            </div>
          </div>
          <span style={{
            color: COLORS.textSecondary,
            fontSize: 10,
            fontWeight: 500,
            maxWidth: 64,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>Create Story</span>
        </div>
        
        {/* User Stories */}
        {stories?.map((story, index) => (
          <div 
            key={story.id || index}
            onClick={() => onStoryPress?.(story)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: story.hasUnseen 
                ? `conic-gradient(${COLORS.primary}, ${COLORS.secondary}, ${COLORS.accent}, ${COLORS.primary})`
                : `linear-gradient(135deg, ${COLORS.border}, ${COLORS.border})`,
              padding: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: COLORS.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {story.avatarUrl ? (
                  <img 
                    src={story.avatarUrl} 
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 18, color: COLORS.text, fontWeight: 700 }}>
                    {story.username?.[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </div>
            <span style={{
              color: COLORS.textSecondary,
              fontSize: 10,
              fontWeight: 500,
              maxWidth: 64,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{story.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 5. WHAT'S ON YOUR MIND
// ============================================================
const WhatsOnYourMind = ({ onPostPress }) => {
  const options = [
    { icon: '📷', label: 'Photo', action: 'photo' },
    { icon: '🎬', label: 'Video', action: 'video' },
    { icon: '📊', label: 'Poll', action: 'poll' },
    { icon: '😊', label: 'Feeling', action: 'feeling' },
  ];
  
  return (
    <div style={{
      padding: '12px 16px',
      background: COLORS.bgSecondary,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: COLORS.gradient1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>?</span>
        </div>
        <button 
          onClick={() => onPostPress?.()}
          style={{
            flex: 1,
            textAlign: 'left',
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 24,
            padding: '10px 16px',
            color: COLORS.textSecondary,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          What's on your mind?
        </button>
      </div>
      
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${COLORS.borderLight}`,
      }}>
        {options.map(opt => (
          <button
            key={opt.label}
            onClick={() => onPostPress?.(opt.action)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: COLORS.textSecondary,
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 12,
              transition: 'all 0.2s',
            }}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 6. POST CARD
// ============================================================
const PostCard = memo(({ post, currentUser, onLike, onComment, onShare, onSave, onMore, onFollow, onViewProfile }) => {
  const [liked, setLiked] = useState(post?.isLiked || false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post?.commentsList || []);
  
  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    onLike?.(post.id);
  };
  
  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now(),
      username: currentUser?.username || 'You',
      text: commentText,
      time: 'just now',
      avatar: currentUser?.avatarUrl || null,
    };
    setComments([...comments, newComment]);
    setCommentText('');
    onComment?.(post.id, commentText);
  };
  
  return (
    <div style={{
      background: COLORS.bgSecondary,
      borderBottom: `1px solid ${COLORS.border}`,
      padding: '12px 16px 16px',
    }}>
      {/* Post Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
      }}>
        <div 
          onClick={() => onViewProfile?.(post.userId)}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: COLORS.gradient1,
            padding: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: COLORS.bg,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {post?.avatarUrl ? (
              <img 
                src={post.avatarUrl} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 18, color: COLORS.text, fontWeight: 700 }}>
                {post?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span 
              onClick={() => onViewProfile?.(post.userId)}
              style={{
                color: COLORS.text,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >{post?.username}</span>
            {post?.verified && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.accent}>
                <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            )}
            <span style={{
              color: COLORS.textTertiary,
              fontSize: 12,
              marginLeft: 'auto',
            }}>{timeAgo(post?.createdAt)}</span>
          </div>
          <span style={{
            color: COLORS.textSecondary,
            fontSize: 12,
          }}>@{post?.username}</span>
        </div>
        
        <button 
          onClick={() => onMore?.(post)}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textTertiary,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
      
      {/* Post Content */}
      {post?.content && (
        <p style={{
          color: COLORS.text,
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 10,
        }}>
          {post.content}
        </p>
      )}
      
      {/* Post Media */}
      {post?.mediaUrl && (
        <div style={{
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
          background: COLORS.bgCard,
          position: 'relative',
          aspectRatio: post.mediaType?.startsWith('video') ? '9/16' : 'auto',
        }}>
          {post.mediaType?.startsWith('video') ? (
            <video 
              src={post.mediaUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              controls
            />
          ) : (
            <img 
              src={post.mediaUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      )}
      
      {/* Engagement Stats */}
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '8px 0',
        borderBottom: `1px solid ${COLORS.borderLight}`,
      }}>
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>{formatNumber(likeCount)}</span> likes
        </span>
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>{formatNumber(post?.comments || comments.length)}</span> comments
        </span>
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>{formatNumber(post?.shares || 0)}</span> shares
        </span>
      </div>
      
      {/* Action Buttons - UNIQUE DESIGN */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        paddingTop: 8,
      }}>
        <ActionButton 
          icon={liked ? '❤️' : '🤍'}
          label="Like"
          active={liked}
          onClick={handleLike}
        />
        <ActionButton 
          icon="💬"
          label="Comment"
          onClick={() => setShowComments(!showComments)}
        />
        <ActionButton 
          icon="↗️"
          label="Share"
          onClick={onShare}
        />
        <ActionButton 
          icon="🔖"
          label="Save"
          onClick={onSave}
        />
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${COLORS.borderLight}`,
        }}>
          {/* Comment input - UNIQUE DESIGN */}
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: COLORS.bgCard,
            borderRadius: 24,
            padding: '4px 4px 4px 16px',
            border: `1px solid ${COLORS.border}`,
          }}>
            <input
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: COLORS.text,
                fontSize: 13,
                outline: 'none',
                padding: '8px 0',
              }}
            />
            <button 
              onClick={handleAddComment}
              style={{
                background: COLORS.gradient1,
                border: 'none',
                borderRadius: '50%',
                width: 34,
                height: 34,
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          
          {/* Comments list */}
          <div style={{ marginTop: 10 }}>
            {comments.map(comment => (
              <CommentItem 
                key={comment.id}
                username={comment.username}
                text={comment.text}
                time={comment.time}
                avatar={comment.avatar}
                onViewProfile={() => onViewProfile?.(comment.userId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const ActionButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'none',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      cursor: 'pointer',
      borderRadius: 20,
      transition: 'all 0.2s',
      color: active ? COLORS.primary : COLORS.textSecondary,
      position: 'relative',
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    {active && (
      <div style={{
        position: 'absolute',
        bottom: -2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 12,
        height: 2,
        borderRadius: 2,
        background: COLORS.primary,
      }} />
    )}
  </button>
);

const CommentItem = ({ username, text, time, avatar, onViewProfile }) => (
  <div style={{
    display: 'flex',
    gap: 10,
    padding: '8px 0',
    borderBottom: `1px solid ${COLORS.borderLight}`,
  }}>
    <div 
      onClick={onViewProfile}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: COLORS.gradient1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {avatar ? (
        <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>
          {username[0]}
        </span>
      )}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span 
          onClick={onViewProfile}
          style={{
            color: COLORS.text,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >{username}</span>
        <span style={{
          color: COLORS.textTertiary,
          fontSize: 11,
        }}>{time}</span>
      </div>
      <p style={{
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 2,
      }}>{text}</p>
    </div>
  </div>
);

// ============================================================
// 7. HOME FEED
// ============================================================
export const HomeFeed = ({ 
  currentUser, 
  posts, 
  stories, 
  onPostPress,
  onStoryPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onMore,
  onFollow,
  onCreateStory,
  onViewProfile,
}) => {
  const [feedType, setFeedType] = useState('popular');
  const feedOptions = ['Popular', 'Nearby', 'Following'];
  
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: COLORS.bg,
      paddingBottom: 80,
    }}>
      {/* Stories Bar */}
      <StoriesBar 
        stories={stories} 
        currentUser={currentUser}
        onStoryPress={onStoryPress}
        onCreateStory={onCreateStory}
      />
      
      {/* What's On Your Mind */}
      <WhatsOnYourMind onPostPress={onPostPress} />
      
      {/* Feed Type Selector - UNIQUE DESIGN */}
      <div style={{
        display: 'flex',
        gap: 0,
        padding: '0 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        {feedOptions.map(option => (
          <button
            key={option}
            onClick={() => setFeedType(option.toLowerCase())}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              color: feedType === option.toLowerCase() ? COLORS.text : COLORS.textTertiary,
              fontSize: 14,
              fontWeight: feedType === option.toLowerCase() ? 700 : 500,
              cursor: 'pointer',
              borderBottom: feedType === option.toLowerCase() 
                ? `2px solid ${COLORS.primary}`
                : '2px solid transparent',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            {option}
            {feedType === option.toLowerCase() && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 20,
                height: 3,
                borderRadius: 3,
                background: COLORS.primary,
              }} />
            )}
          </button>
        ))}
      </div>
      
      {/* Posts Feed */}
      <div style={{ paddingTop: 4 }}>
        {posts?.length > 0 ? (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onLike={onLike}
              onComment={onComment}
              onShare={onShare}
              onSave={onSave}
              onMore={onMore}
              onFollow={onFollow}
              onViewProfile={onViewProfile}
            />
          ))
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textTertiary,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📭</span>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No posts yet</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 8. NOTIFICATIONS PAGE
// ============================================================
export const NotificationsPage = ({ 
  notifications, 
  currentUser, 
  onClose, 
  onNotificationPress,
  onFollowBack,
  onViewProfile,
}) => {
  const [filter, setFilter] = useState('all');
  const filters = ['All', 'Likes', 'Comments', 'Mentions'];
  
  // Group notifications by date
  const grouped = notifications?.reduce((acc, notif) => {
    const isToday = notif.createdAt?.toDate 
      ? new Date(notif.createdAt.toDate()).toDateString() === new Date().toDateString()
      : false;
    const key = isToday ? 'New' : 'Earlier';
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {});
  
  const filteredNotifs = filter === 'all' 
    ? notifications 
    : notifications?.filter(n => n.type === filter.slice(0, -1));
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: COLORS.bg,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            color: COLORS.text,
            fontSize: 20,
            fontWeight: 700,
          }}>Notifications</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textTertiary,
              fontSize: 20,
              cursor: 'pointer',
            }}
          >✕</button>
        </div>
        
        {/* Filter Tabs - UNIQUE DESIGN */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
        }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              style={{
                background: 'none',
                border: 'none',
                color: filter === f.toLowerCase() ? COLORS.text : COLORS.textTertiary,
                fontSize: 14,
                fontWeight: filter === f.toLowerCase() ? 700 : 500,
                cursor: 'pointer',
                padding: '4px 0',
                borderBottom: filter === f.toLowerCase() 
                  ? `2px solid ${COLORS.primary}`
                  : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      {/* Notification List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px',
      }}>
        {Object.entries(grouped || {}).map(([section, items]) => (
          <div key={section}>
            <div style={{
              color: COLORS.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              padding: '16px 0 8px',
            }}>
              {section}
            </div>
            
            {items.map(notif => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                currentUser={currentUser}
                onPress={onNotificationPress}
                onFollowBack={onFollowBack}
                onViewProfile={onViewProfile}
              />
            ))}
          </div>
        ))}
        
        {(!notifications || notifications.length === 0) && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textTertiary,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔔</span>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No notifications yet</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>We'll notify you when something happens</p>
          </div>
        )}
      </div>
    </div>
  );
};

const NotificationItem = ({ notif, currentUser, onPress, onFollowBack, onViewProfile }) => {
  const typeConfig = {
    like: { icon: '❤️', color: COLORS.primary, bg: 'rgba(255,33,86,0.15)' },
    comment: { icon: '💬', color: COLORS.accent, bg: 'rgba(10,132,255,0.15)' },
    follow: { icon: '👤', color: COLORS.secondary, bg: 'rgba(157,78,221,0.15)' },
    mention: { icon: '@', color: COLORS.warning, bg: 'rgba(255,177,0,0.15)' },
    share: { icon: '↗️', color: COLORS.success, bg: 'rgba(46,213,115,0.15)' },
  };
  
  const config = typeConfig[notif.type] || { icon: '🔔', color: COLORS.textTertiary, bg: 'rgba(255,255,255,0.05)' };
  
  return (
    <div 
      onClick={() => onPress?.(notif)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: `1px solid ${COLORS.borderLight}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div 
        onClick={(e) => { e.stopPropagation(); onViewProfile?.(notif.senderId); }}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: config.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 20,
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {notif.senderAvatar ? (
          <img 
            src={notif.senderAvatar} 
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
            {notif.senderName?.[0] || '?'}
          </span>
        )}
        <div style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: COLORS.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          border: `2px solid ${COLORS.bg}`,
        }}>
          {config.icon}
        </div>
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          color: COLORS.text,
          fontSize: 13,
          lineHeight: 1.4,
        }}>
          <span 
            onClick={(e) => { e.stopPropagation(); onViewProfile?.(notif.senderId); }}
            style={{ fontWeight: 600, cursor: 'pointer' }}
          >{notif.senderName}</span>
          {' '}{notif.message}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
        }}>
          <span style={{
            color: COLORS.textTertiary,
            fontSize: 11,
          }}>{notif.time || timeAgo(notif.createdAt)}</span>
          {notif.type === 'follow' && !notif.followedBack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFollowBack?.(notif.senderId);
              }}
              style={{
                background: COLORS.gradient1,
                border: 'none',
                borderRadius: 16,
                padding: '4px 14px',
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Follow back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 9. PROFILE PAGE
// ============================================================
export const ProfilePage = ({ 
  user, 
  currentUser, 
  posts, 
  followers, 
  following, 
  onEditProfile, 
  onAddProfile, 
  onPostPress,
  onViewProfile,
  onFollow,
}) => {
  const [activeTab, setActiveTab] = useState('posts');
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  
  const tabs = [
    { id: 'posts', icon: '📱', label: 'Posts' },
    { id: 'saved', icon: '🔖', label: 'Saved' },
    { id: 'liked', icon: '❤️', label: 'Liked' },
  ];
  
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: COLORS.bg,
      paddingBottom: 80,
    }}>
      {/* Profile Header */}
      <div style={{
        padding: '20px 16px 16px',
        background: COLORS.bgSecondary,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Avatar with gradient ring - UNIQUE */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `conic-gradient(${COLORS.primary}, ${COLORS.secondary}, ${COLORS.accent}, ${COLORS.primary})`,
            padding: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: COLORS.bg,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {user?.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 32, color: COLORS.text, fontWeight: 700 }}>
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                color: COLORS.text,
                fontSize: 20,
                fontWeight: 700,
              }}>{user?.username}</span>
              {user?.verified && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.accent}>
                  <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
            </div>
            <span style={{
              color: COLORS.textSecondary,
              fontSize: 13,
            }}>@{user?.username}</span>
            
            {/* Stats - UNIQUE DESIGN */}
            <div style={{
              display: 'flex',
              gap: 16,
              marginTop: 10,
            }}>
              <div 
                onClick={() => setActiveTab('posts')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
                  {formatNumber(posts?.length || 0)}
                </span>
                <span style={{ color: COLORS.textTertiary, fontSize: 11 }}>Posts</span>
              </div>
              <div 
                onClick={() => setShowFollowers(true)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
                  {formatNumber(followers?.length || 0)}
                </span>
                <span style={{ color: COLORS.textTertiary, fontSize: 11 }}>Followers</span>
              </div>
              <div 
                onClick={() => setShowFollowing(true)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
                  {formatNumber(following?.length || 0)}
                </span>
                <span style={{ color: COLORS.textTertiary, fontSize: 11 }}>Following</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bio */}
        {user?.bio && (
          <p style={{
            color: COLORS.textSecondary,
            fontSize: 13,
            marginTop: 12,
            lineHeight: 1.5,
          }}>{user.bio}</p>
        )}
        
        {/* Action Buttons - UNIQUE DESIGN */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 14,
        }}>
          <button 
            onClick={onEditProfile}
            style={{
              flex: 1,
              background: COLORS.gradient1,
              border: 'none',
              borderRadius: 24,
              padding: '10px 0',
              color: 'white',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Edit Profile
          </button>
          <button 
            onClick={onAddProfile}
            style={{
              flex: 1,
              background: 'none',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 24,
              padding: '10px 0',
              color: COLORS.textSecondary,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Add Profile
          </button>
        </div>
        
        {/* Level Badge - UNIQUE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 12,
          padding: '6px 14px',
          background: `linear-gradient(135deg, ${COLORS.primary}22, ${COLORS.secondary}22)`,
          borderRadius: 20,
          border: `1px solid ${COLORS.primary}33`,
        }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
            Level {user?.level || 1}
          </span>
          <span style={{
            color: COLORS.textTertiary,
            fontSize: 11,
          }}>• {formatNumber(user?.xp || 0)} XP</span>
        </div>
      </div>
      
      {/* Tab Navigation - UNIQUE */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              color: activeTab === tab.id ? COLORS.text : COLORS.textTertiary,
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              borderBottom: activeTab === tab.id 
                ? `2px solid ${COLORS.primary}`
                : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div style={{ padding: 2 }}>
        {activeTab === 'posts' && (
          posts?.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
            }}>
              {posts.map(post => (
                <div 
                  key={post.id}
                  onClick={() => onPostPress?.(post)}
                  style={{
                    aspectRatio: '1/1',
                    background: COLORS.bgCard,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  {post.mediaUrl && (
                    post.mediaType?.startsWith('video') ? (
                      <video 
                        src={post.mediaUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                      />
                    ) : (
                      <img 
                        src={post.mediaUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 6,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 12,
                    padding: '2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    ❤️ {formatNumber(post.likes || 0)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: COLORS.textTertiary,
            }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📷</span>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No posts yet</p>
              <p style={{ fontSize: 14, marginTop: 4 }}>Share your first memory!</p>
            </div>
          )
        )}
        
        {activeTab === 'saved' && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textTertiary,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔖</span>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No saved posts</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>Save posts you love!</p>
          </div>
        )}
        
        {activeTab === 'liked' && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textTertiary,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>❤️</span>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No liked posts</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>Like posts to see them here!</p>
          </div>
        )}
      </div>
      
      {/* Followers Modal */}
      {showFollowers && (
        <div 
          onClick={() => setShowFollowers(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 430,
              background: COLORS.bgSecondary,
              borderRadius: '24px 24px 0 0',
              padding: '20px 16px 40px',
              maxHeight: '70%',
              overflow: 'auto',
            }}
          >
            <div style={{
              width: 36,
              height: 4,
              background: COLORS.border,
              borderRadius: 2,
              margin: '0 auto 16px',
            }} />
            <div style={{
              color: COLORS.text,
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
            }}>Followers</div>
            {followers?.map(user => (
              <UserListItem 
                key={user.id} 
                user={user} 
                onPress={() => { onViewProfile?.(user.id); setShowFollowers(false); }}
                onFollow={onFollow}
                currentUser={currentUser}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Following Modal */}
      {showFollowing && (
        <div 
          onClick={() => setShowFollowing(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 430,
              background: COLORS.bgSecondary,
              borderRadius: '24px 24px 0 0',
              padding: '20px 16px 40px',
              maxHeight: '70%',
              overflow: 'auto',
            }}
          >
            <div style={{
              width: 36,
              height: 4,
              background: COLORS.border,
              borderRadius: 2,
              margin: '0 auto 16px',
            }} />
            <div style={{
              color: COLORS.text,
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
            }}>Following</div>
            {following?.map(user => (
              <UserListItem 
                key={user.id} 
                user={user} 
                onPress={() => { onViewProfile?.(user.id); setShowFollowing(false); }}
                onFollow={onFollow}
                currentUser={currentUser}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const UserListItem = ({ user, onPress, onFollow, currentUser }) => {
  const isFollowing = currentUser?.following?.includes(user.id);
  
  return (
    <div 
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: `1px solid ${COLORS.borderLight}`,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: COLORS.gradient1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {user?.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            color: COLORS.text,
            fontWeight: 600,
            fontSize: 14,
          }}>{user?.username}</span>
          {user?.verified && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.accent}>
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          )}
        </div>
        <span style={{
          color: COLORS.textSecondary,
          fontSize: 12,
        }}>@{user?.username}</span>
      </div>
      
      {user?.id !== currentUser?.id && (
        <button
          onClick={(e) => { e.stopPropagation(); onFollow?.(user.id); }}
          style={{
            background: isFollowing ? 'none' : COLORS.gradient1,
            border: isFollowing ? `1px solid ${COLORS.border}` : 'none',
            borderRadius: 20,
            padding: '6px 16px',
            color: isFollowing ? COLORS.textSecondary : 'white',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
};

// ============================================================
// 10. FRIENDS / DISCOVERY PAGE
// ============================================================
export const FriendsPage = ({ 
  currentUser, 
  users, 
  onFollow, 
  onViewProfile, 
  onMessage,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  
  // Smart suggestions based on mutual friends and interests
  const suggestions = users
    .filter(u => u.id !== currentUser?.id)
    .filter(u => !currentUser?.following?.includes(u.id))
    .map(u => ({
      ...u,
      mutualFriends: (u.followers || []).filter(id => currentUser?.following?.includes(id)).length,
    }))
    .sort((a, b) => b.mutualFriends - a.mutualFriends)
    .slice(0, 10);
  
  // Close friends = people you interact with most
  const closeFriends = users
    .filter(u => currentUser?.following?.includes(u.id))
    .slice(0, 6);
  
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: COLORS.bg,
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: COLORS.bgSecondary,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{
          color: COLORS.text,
          fontSize: 20,
          fontWeight: 700,
        }}>Friends</span>
        
        {/* Search - UNIQUE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          background: COLORS.bgCard,
          borderRadius: 24,
          padding: '8px 16px',
          border: `1px solid ${COLORS.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: COLORS.text,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
      </div>
      
      {/* Tabs - UNIQUE */}
      <div style={{
        display: 'flex',
        padding: '0 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        {['Discover', 'Your Friends', 'Requests'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase().replace(' ', ''))}
            style={{
              padding: '12px 0',
              marginRight: 20,
              background: 'none',
              border: 'none',
              color: activeTab === tab.toLowerCase().replace(' ', '') 
                ? COLORS.text 
                : COLORS.textTertiary,
              fontSize: 14,
              fontWeight: activeTab === tab.toLowerCase().replace(' ', '') ? 700 : 500,
              cursor: 'pointer',
              borderBottom: activeTab === tab.toLowerCase().replace(' ', '') 
                ? `2px solid ${COLORS.primary}`
                : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {/* Smart Suggestions - UNIQUE */}
      {activeTab === 'discover' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            background: `linear-gradient(135deg, ${COLORS.primary}15, ${COLORS.secondary}15)`,
            borderRadius: 16,
            border: `1px solid ${COLORS.primary}22`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{
                color: COLORS.text,
                fontSize: 13,
                fontWeight: 600,
              }}>Smart Suggestions</span>
            </div>
            <p style={{
              color: COLORS.textSecondary,
              fontSize: 12,
              marginTop: 4,
            }}>
              AI-powered picks based on your interests, mutual friends & activity
            </p>
          </div>
          
          {suggestions.map(user => (
            <SuggestionCard
              key={user.id}
              user={user}
              onFollow={onFollow}
              onViewProfile={onViewProfile}
              onMessage={onMessage}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}
      
      {/* Close Friends */}
      {activeTab === 'discover' && closeFriends.length > 0 && (
        <div style={{ padding: '16px' }}>
          <div style={{
            color: COLORS.textSecondary,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
          }}>✨ Close Friends</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {closeFriends.map(user => (
              <div 
                key={user.id}
                onClick={() => onViewProfile?.(user.id)}
                style={{
                  background: COLORS.bgSecondary,
                  borderRadius: 16,
                  padding: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: COLORS.gradient1,
                  margin: '0 auto 8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {user?.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {user?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <span style={{
                  color: COLORS.text,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>@{user?.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeTab === 'yourfriends' && (
        <div style={{ padding: '16px' }}>
          {currentUser?.following?.map(id => {
            const user = users.find(u => u.id === id);
            if (!user) return null;
            return (
              <FriendListItem
                key={user.id}
                user={user}
                onViewProfile={onViewProfile}
                onMessage={onMessage}
                currentUser={currentUser}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const SuggestionCard = ({ user, onFollow, onViewProfile, onMessage, currentUser }) => {
  const isFollowing = currentUser?.following?.includes(user.id);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: `1px solid ${COLORS.borderLight}`,
    }}>
      <div 
        onClick={() => onViewProfile?.(user.id)}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: COLORS.gradient1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {user?.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span 
            onClick={() => onViewProfile?.(user.id)}
            style={{
              color: COLORS.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >{user?.username}</span>
          {user?.verified && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.accent}>
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          )}
        </div>
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 2,
        }}>
          <span style={{
            color: COLORS.textTertiary,
            fontSize: 12,
          }}>{formatNumber(user?.followers?.length || 0)} followers</span>
          {user.mutualFriends > 0 && (
            <span style={{
              color: COLORS.textTertiary,
              fontSize: 12,
            }}>{user.mutualFriends} mutual</span>
          )}
        </div>
      </div>
      
      <div style={{
        display: 'flex',
        gap: 6,
      }}>
        {!isFollowing && (
          <button
            onClick={() => onFollow?.(user.id)}
            style={{
              background: COLORS.gradient1,
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Follow
          </button>
        )}
        <button
          onClick={() => onMessage?.(user.id)}
          style={{
            background: 'none',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: '6px 12px',
            color: COLORS.textSecondary,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          💬
        </button>
      </div>
    </div>
  );
};

const FriendListItem = ({ user, onViewProfile, onMessage }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: `1px solid ${COLORS.borderLight}`,
  }}>
    <div 
      onClick={() => onViewProfile?.(user.id)}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: COLORS.gradient1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {user?.avatarUrl ? (
        <img 
          src={user.avatarUrl} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
          {user?.username?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
    
    <div style={{ flex: 1 }}>
      <span 
        onClick={() => onViewProfile?.(user.id)}
        style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >{user?.username}</span>
    </div>
    
    <button
      onClick={() => onMessage?.(user.id)}
      style={{
        background: COLORS.gradient1,
        border: 'none',
        borderRadius: 20,
        padding: '6px 14px',
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Message
    </button>
  </div>
);

// ============================================================
// 11. CREATE POST MODAL
// ============================================================
export const CreatePostModal = ({ onClose, onPost, currentUser }) => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };
  
  const handlePost = async () => {
    if (!content.trim() && !selectedFile) return;
    
    setUploading(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      
      if (selectedFile) {
        mediaUrl = await uploadToCloudinary(selectedFile);
        mediaType = selectedFile.type;
      }
      
      const postData = {
        content: content.trim(),
        mediaUrl,
        mediaType,
        userId: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        shares: 0,
        isPublic,
      };
      
      await addDoc(collection(db, 'posts'), postData);
      onPost?.();
      onClose();
    } catch (error) {
      console.error('Error posting:', error);
    }
    setUploading(false);
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: COLORS.bgSecondary,
        borderRadius: 24,
        padding: '20px',
        border: `1px solid ${COLORS.border}`,
        maxHeight: '90%',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <span style={{
            color: COLORS.text,
            fontSize: 18,
            fontWeight: 700,
          }}>Create Post</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textTertiary,
              fontSize: 20,
              cursor: 'pointer',
            }}
          >✕</button>
        </div>
        
        {/* User Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: COLORS.gradient1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {currentUser?.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: 'white', fontWeight: 700 }}>
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <span style={{
            color: COLORS.text,
            fontWeight: 600,
            fontSize: 14,
          }}>{currentUser?.username}</span>
        </div>
        
        {/* Content Input */}
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: '100%',
            minHeight: 100,
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: '12px',
            color: COLORS.text,
            fontSize: 14,
            resize: 'none',
            outline: 'none',
          }}
        />
        
        {/* File Preview */}
        {filePreview && (
          <div style={{
            position: 'relative',
            marginTop: 12,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {selectedFile?.type?.startsWith('video') ? (
              <video 
                src={filePreview} 
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
                controls
              />
            ) : (
              <img 
                src={filePreview} 
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
              />
            )}
            <button
              onClick={() => { setSelectedFile(null); setFilePreview(null); }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.7)',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}
        
        {/* Actions - UNIQUE */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 12,
          padding: '8px 12px',
          background: COLORS.bgCard,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
        }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textSecondary,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 12,
              transition: 'all 0.2s',
            }}
          >
            📷 Photo/Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textSecondary,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 12,
            }}
          >
            😊 Feeling
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textSecondary,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 12,
            }}
          >
            📍 Check-in
          </button>
        </div>
        
        {/* Privacy - UNIQUE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 12,
          padding: '8px 12px',
          background: COLORS.bgCard,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
        }}>
          <span style={{
            color: COLORS.textSecondary,
            fontSize: 13,
          }}>Who can see this?</span>
          <button
            onClick={() => setIsPublic(!isPublic)}
            style={{
              marginLeft: 'auto',
              background: isPublic ? COLORS.gradient1 : 'none',
              border: isPublic ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: 20,
              padding: '4px 14px',
              color: isPublic ? 'white' : COLORS.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isPublic ? '🌍 Everyone' : '🔒 Friends'}
          </button>
        </div>
        
        {/* Post Button - UNIQUE */}
        <button
          onClick={handlePost}
          disabled={uploading || (!content.trim() && !selectedFile)}
          style={{
            width: '100%',
            marginTop: 16,
            background: uploading || (!content.trim() && !selectedFile) 
              ? COLORS.border 
              : COLORS.gradient1,
            border: 'none',
            borderRadius: 24,
            padding: '12px 0',
            color: uploading || (!content.trim() && !selectedFile) 
              ? COLORS.textTertiary 
              : 'white',
            fontSize: 14,
            fontWeight: 700,
            cursor: uploading || (!content.trim() && !selectedFile) 
              ? 'not-allowed' 
              : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {uploading ? 'Posting...' : 'Post ✨'}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 12. CHAT PAGE
// ============================================================
export const ChatPage = ({ 
  currentUser, 
  conversations, 
  users, 
  onSelectConversation,
  onViewProfile,
  onBack,
}) => {
  const [search, setSearch] = useState('');
  
  const filtered = conversations?.filter(conv => {
    const otherUser = users.find(u => u.id === conv.otherUserId);
    return otherUser?.username?.toLowerCase().includes(search.toLowerCase());
  });
  
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: COLORS.bg,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: COLORS.bgSecondary,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.text,
              fontSize: 20,
              cursor: 'pointer',
            }}
          >←</button>
        )}
        <span style={{
          color: COLORS.text,
          fontSize: 20,
          fontWeight: 700,
        }}>Chat</span>
      </div>
      
      {/* Search */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: COLORS.bgCard,
          borderRadius: 24,
          padding: '8px 16px',
          border: `1px solid ${COLORS.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: COLORS.text,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered?.length > 0 ? (
          filtered.map(conv => {
            const otherUser = users.find(u => u.id === conv.otherUserId);
            if (!otherUser) return null;
            
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation?.(conv)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderBottom: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <div 
                  onClick={(e) => { e.stopPropagation(); onViewProfile?.(otherUser.id); }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: COLORS.gradient1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  {otherUser?.avatarUrl ? (
                    <img 
                      src={otherUser.avatarUrl} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {otherUser?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{
                      color: COLORS.text,
                      fontWeight: 600,
                      fontSize: 14,
                    }}>{otherUser?.username}</span>
                    {otherUser?.verified && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.accent}>
                        <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    color: COLORS.textTertiary,
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}>{conv.lastMessage || 'Say hi! 👋'}</span>
                </div>
                
                {conv.unreadCount > 0 && (
                  <div style={{
                    background: COLORS.primary,
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: 'white',
                    fontWeight: 700,
                  }}>
                    {conv.unreadCount}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textTertiary,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>💬</span>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No messages yet</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>Start a conversation with friends!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 13. SHARE MODAL
// ============================================================
export const ShareModal = ({ post, onClose, onShare }) => {
  const shareOptions = [
    { icon: '📋', label: 'Copy link', action: 'copy' },
    { icon: '📘', label: 'Facebook', action: 'facebook' },
    { icon: '📱', label: 'Messenger', action: 'messenger' },
    { icon: '🎵', label: 'TikTok', action: 'tiktok' },
    { icon: '💬', label: 'WhatsApp', action: 'whatsapp' },
    { icon: '📸', label: 'Instagram', action: 'instagram' },
    { icon: '✈️', label: 'Telegram', action: 'telegram' },
    { icon: '📩', label: 'SMS', action: 'sms' },
  ];
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        background: COLORS.bgSecondary,
        borderRadius: '24px 24px 0 0',
        padding: '20px 16px 40px',
        maxHeight: '70%',
        overflow: 'auto',
      }}>
        <div style={{
          width: 36,
          height: 4,
          background: COLORS.border,
          borderRadius: 2,
          margin: '0 auto 16px',
        }} />
        
        <div style={{
          color: COLORS.text,
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 16,
        }}>Share</div>
        
        {/* Post Preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px',
          background: COLORS.bgCard,
          borderRadius: 16,
          marginBottom: 16,
        }}>
          {post?.mediaUrl && (
            <div style={{
              width: 52,
              height: 64,
              borderRadius: 12,
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {post.mediaType?.startsWith('video') ? (
                <video src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              color: COLORS.text,
              fontWeight: 600,
              fontSize: 13,
            }}>@{post?.username}</span>
            <p style={{
              color: COLORS.textSecondary,
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{post?.content || 'Shared post'}</p>
          </div>
        </div>
        
        {/* Share Options - UNIQUE */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}>
          {shareOptions.map(opt => (
            <button
              key={opt.label}
              onClick={() => onShare?.(opt.action, post)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0',
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: COLORS.gradient1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}>
                {opt.icon}
              </div>
              <span style={{
                color: COLORS.textSecondary,
                fontSize: 11,
                fontWeight: 500,
              }}>{opt.label}</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 16,
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 24,
            padding: '12px 0',
            color: COLORS.textSecondary,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 14. MORE OPTIONS MENU
// ============================================================
export const MoreOptionsMenu = ({ post, onClose, onAction }) => {
  const options = [
    { icon: '✏️', label: 'Edit Post', action: 'edit' },
    { icon: '📌', label: 'Pin Post', action: 'pin' },
    { icon: '📋', label: 'Copy Link', action: 'copy' },
    { icon: '🔄', label: 'Repost', action: 'repost' },
    { icon: '👥', label: 'Send to Friends', action: 'send' },
    { icon: '📁', label: 'Add to Collection', action: 'collect' },
    { icon: '🔇', label: 'Mute User', action: 'mute' },
    { icon: '🚫', label: 'Block User', action: 'block', danger: true },
    { icon: '🚩', label: 'Report', action: 'report', danger: true },
  ];
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        background: COLORS.bgSecondary,
        borderRadius: 24,
        padding: '12px 0',
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
      }}>
        {options.map((opt, index) => (
          <button
            key={opt.label}
            onClick={() => { onAction?.(opt.action, post); onClose(); }}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: index < options.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
              color: opt.danger ? COLORS.danger : COLORS.text,
              fontSize: 14,
              fontWeight: opt.danger ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 18 }}>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
        
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderTop: `1px solid ${COLORS.borderLight}`,
            color: COLORS.textTertiary,
            fontSize: 14,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 15. SAVE CONFIRMATION
// ============================================================
export const SaveConfirmation = ({ onClose, onViewCollections }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  }}>
    <div style={{
      width: '100%',
      maxWidth: 320,
      background: COLORS.bgSecondary,
      borderRadius: 24,
      padding: '24px 20px',
      textAlign: 'center',
      border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: COLORS.gradient1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
      }}>
        <span style={{ fontSize: 28 }}>🔖</span>
      </div>
      <h3 style={{
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 4,
      }}>Saved!</h3>
      <p style={{
        color: COLORS.textSecondary,
        fontSize: 13,
        marginBottom: 16,
      }}>This post has been saved to your collection.</p>
      
      <button
        onClick={onViewCollections}
        style={{
          width: '100%',
          background: COLORS.gradient1,
          border: 'none',
          borderRadius: 24,
          padding: '10px 0',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        View Collections
      </button>
      
      <button
        onClick={onClose}
        style={{
          width: '100%',
          marginTop: 8,
          background: 'none',
          border: 'none',
          color: COLORS.textTertiary,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Done
      </button>
    </div>
  </div>
);

// ============================================================
// 16. LIKES PAGE
// ============================================================
export const LikesPage = ({ likes, onClose, onViewProfile, onFollow }) => {
  const [filter, setFilter] = useState('all');
  const filters = ['All', 'People'];
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: COLORS.bg,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{
              color: COLORS.text,
              fontSize: 20,
              fontWeight: 700,
            }}>Likes</span>
            <span style={{
              color: COLORS.textTertiary,
              fontSize: 13,
              marginLeft: 8,
            }}>{formatNumber(likes?.length || 0)}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textTertiary,
              fontSize: 20,
              cursor: 'pointer',
            }}
          >✕</button>
        </div>
        
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
        }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              style={{
                background: 'none',
                border: 'none',
                color: filter === f.toLowerCase() ? COLORS.text : COLORS.textTertiary,
                fontSize: 14,
                fontWeight: filter === f.toLowerCase() ? 700 : 500,
                cursor: 'pointer',
                padding: '4px 0',
                borderBottom: filter === f.toLowerCase() 
                  ? `2px solid ${COLORS.primary}`
                  : '2px solid transparent',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
      }}>
        {likes?.map(like => (
          <LikeItem
            key={like.id}
            user={like}
            onViewProfile={onViewProfile}
            onFollow={onFollow}
          />
        ))}
      </div>
    </div>
  );
};

const LikeItem = ({ user, onViewProfile, onFollow }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px solid ${COLORS.borderLight}`,
  }}>
    <div 
      onClick={() => onViewProfile?.(user.id)}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: COLORS.gradient1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {user?.avatarUrl ? (
        <img 
          src={user.avatarUrl} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
          {user?.username?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
    
    <div style={{ flex: 1 }}>
      <span 
        onClick={() => onViewProfile?.(user.id)}
        style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >{user?.username}</span>
      <span style={{
        color: COLORS.textTertiary,
        fontSize: 12,
        marginLeft: 8,
      }}>liked your post</span>
    </div>
    
    <button
      onClick={() => onFollow?.(user.id)}
      style={{
        background: COLORS.gradient1,
        border: 'none',
        borderRadius: 20,
        padding: '6px 16px',
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Follow
    </button>
  </div>
);

// ============================================================
// 17. COMMENTS PAGE
// ============================================================
export const CommentsPage = ({ post, onClose, onAddComment, onViewProfile }) => {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post?.commentsList || []);
  
  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now(),
      username: 'You',
      text: commentText,
      time: 'just now',
    };
    setComments([...comments, newComment]);
    onAddComment?.(post.id, commentText);
    setCommentText('');
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: COLORS.bg,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <span style={{
            color: COLORS.text,
            fontSize: 18,
            fontWeight: 700,
          }}>Comments</span>
          <span style={{
            color: COLORS.textTertiary,
            fontSize: 13,
            marginLeft: 8,
          }}>{formatNumber(comments.length)}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textTertiary,
            fontSize: 20,
            cursor: 'pointer',
          }}
        >✕</button>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
      }}>
        {comments.map(comment => (
          <CommentItem
            key={comment.id}
            username={comment.username}
            text={comment.text}
            time={comment.time}
            avatar={comment.avatar}
            onViewProfile={() => onViewProfile?.(comment.userId)}
          />
        ))}
      </div>
      
      <div style={{
        padding: '12px 16px 20px',
        borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.bgSecondary,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          background: COLORS.bgCard,
          borderRadius: 24,
          padding: '4px 4px 4px 16px',
          border: `1px solid ${COLORS.border}`,
        }}>
          <input
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: COLORS.text,
              fontSize: 13,
              outline: 'none',
              padding: '8px 0',
            }}
          />
          <button 
            onClick={handleAddComment}
            style={{
              background: COLORS.gradient1,
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 18. MAIN APP
// ============================================================
export default function DaguV3App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await getDoc(doc(db, 'users', fbUser.uid));
        if (profile.exists()) {
          setCurrentUser({ id: fbUser.uid, ...profile.data() });
        } else {
          // Create profile if doesn't exist
          await setDoc(doc(db, 'users', fbUser.uid), {
            username: fbUser.displayName?.split(' ')[0]?.toLowerCase() || 'user',
            email: fbUser.email,
            avatarUrl: fbUser.photoURL,
            createdAt: new Date().toISOString(),
            followers: [],
            following: [],
            level: 1,
            xp: 0,
            verified: false,
          });
          const newProfile = await getDoc(doc(db, 'users', fbUser.uid));
          setCurrentUser({ id: fbUser.uid, ...newProfile.data() });
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);
  
  // Real-time posts
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const postsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    });
    return () => unsub();
  }, [currentUser]);
  
  // Real-time users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);
  
  // Real-time notifications
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [currentUser]);
  
  const handleLike = async (postId) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const post = posts.find(p => p.id === postId);
    const isLiked = post?.likesBy?.includes(currentUser.id);
    
    await updateDoc(postRef, {
      likes: increment(isLiked ? -1 : 1),
      likesBy: isLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
    });
    
    if (!isLiked && post?.userId !== currentUser.id) {
      await addDoc(collection(db, 'notifications'), {
        userId: post.userId,
        type: 'like',
        senderId: currentUser.id,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatarUrl,
        postId: postId,
        message: 'liked your post',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  };
  
  const handleComment = async (postId, text) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const post = posts.find(p => p.id === postId);
    
    await updateDoc(postRef, {
      comments: increment(1),
    });
    
    if (post?.userId !== currentUser.id) {
      await addDoc(collection(db, 'notifications'), {
        userId: post.userId,
        type: 'comment',
        senderId: currentUser.id,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatarUrl,
        postId: postId,
        message: `commented: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  };
  
  const handleFollow = async (userId) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', userId);
    const user = users.find(u => u.id === userId);
    const isFollowing = user?.followers?.includes(currentUser.id);
    
    await updateDoc(userRef, {
      followers: isFollowing ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
    });
    
    await updateDoc(doc(db, 'users', currentUser.id), {
      following: isFollowing ? arrayRemove(userId) : arrayUnion(userId),
    });
    
    if (!isFollowing) {
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        type: 'follow',
        senderId: currentUser.id,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatarUrl,
        message: 'started following you',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  };
  
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  if (authLoading) {
    return (
      <div style={{
        maxWidth: 430,
        margin: '0 auto',
        height: '100dvh',
        background: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: `3px solid ${COLORS.border}`,
          borderTop: `3px solid ${COLORS.primary}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }
  
  if (!currentUser) {
    return <AuthScreen onLogin={(user) => setCurrentUser(user)} />;
  }
  
  return (
    <div style={{
      maxWidth: 430,
      margin: '0 auto',
      height: '100dvh',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Global Styles */}
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background: ${COLORS.bg}; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      
      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'home' && (
          <HomeFeed
            currentUser={currentUser}
            posts={posts}
            stories={stories}
            onPostPress={() => setShowCreatePost(true)}
            onStoryPress={(story) => console.log('Story pressed', story)}
            onLike={handleLike}
            onComment={handleComment}
            onShare={(post) => { setSelectedPost(post); setShowShare(true); }}
            onSave={(post) => { setSelectedPost(post); setShowSave(true); }}
            onMore={(post) => { setSelectedPost(post); setShowMore(true); }}
            onFollow={handleFollow}
            onCreateStory={() => console.log('Create story')}
            onViewProfile={(userId) => console.log('View profile', userId)}
          />
        )}
        
        {activeTab === 'friends' && (
          <FriendsPage
            currentUser={currentUser}
            users={users}
            onFollow={handleFollow}
            onViewProfile={(userId) => console.log('View profile', userId)}
            onMessage={(userId) => console.log('Message user', userId)}
          />
        )}
        
        {activeTab === 'chat' && (
          <ChatPage
            currentUser={currentUser}
            conversations={conversations}
            users={users}
            onSelectConversation={(conv) => console.log('Select conversation', conv)}
            onViewProfile={(userId) => console.log('View profile', userId)}
          />
        )}
        
        {activeTab === 'profile' && (
          <ProfilePage
            user={currentUser}
            currentUser={currentUser}
            posts={posts.filter(p => p.userId === currentUser.id)}
            followers={users.filter(u => currentUser.followers?.includes(u.id))}
            following={users.filter(u => currentUser.following?.includes(u.id))}
            onEditProfile={() => console.log('Edit profile')}
            onAddProfile={() => console.log('Add profile')}
            onPostPress={(post) => console.log('Post pressed', post)}
            onViewProfile={(userId) => console.log('View profile', userId)}
            onFollow={handleFollow}
          />
        )}
      </div>
      
      {/* Bottom Navigation - UNIQUE DESIGN */}
      <div style={{
        display: 'flex',
        background: COLORS.bgSecondary,
        borderTop: `1px solid ${COLORS.border}`,
        padding: '8px 4px 20px',
        flexShrink: 0,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
      }}>
        {[
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'friends', icon: '👥', label: 'Friends' },
          { id: 'create', icon: '➕', label: 'Create', special: true },
          { id: 'chat', icon: '💬', label: 'Chat' },
          { id: 'profile', icon: '👤', label: 'Profile' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'create') {
                setShowCreatePost(true);
                return;
              }
              setActiveTab(tab.id);
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              position: 'relative',
            }}
          >
            {tab.special ? (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: COLORS.gradient1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: 'white',
                boxShadow: `0 4px 20px ${COLORS.primary}44`,
                marginTop: -20,
              }}>
                {tab.icon}
              </div>
            ) : (
              <>
                <span style={{
                  fontSize: 20,
                  color: activeTab === tab.id ? COLORS.primary : COLORS.textTertiary,
                }}>{tab.icon}</span>
                <span style={{
                  fontSize: 10,
                  color: activeTab === tab.id ? COLORS.primary : COLORS.textTertiary,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                }}>{tab.label}</span>
                {activeTab === tab.id && (
                  <div style={{
                    position: 'absolute',
                    top: -2,
                    width: 16,
                    height: 3,
                    borderRadius: 3,
                    background: COLORS.primary,
                  }} />
                )}
              </>
            )}
          </button>
        ))}
      </div>
      
      {/* Modals */}
      {showCreatePost && (
        <CreatePostModal
          onClose={() => setShowCreatePost(false)}
          onPost={() => showToast('Post created! ✨', 'success')}
          currentUser={currentUser}
        />
      )}
      
      {showNotifications && (
        <NotificationsPage
          notifications={notifications}
          currentUser={currentUser}
          onClose={() => setShowNotifications(false)}
          onNotificationPress={(notif) => console.log('Notification pressed', notif)}
          onFollowBack={handleFollow}
          onViewProfile={(userId) => console.log('View profile', userId)}
        />
      )}
      
      {showShare && selectedPost && (
        <ShareModal
          post={selectedPost}
          onClose={() => { setShowShare(false); setSelectedPost(null); }}
          onShare={(action) => {
            showToast(`Shared via ${action}!`, 'success');
            setShowShare(false);
          }}
        />
      )}
      
      {showSave && (
        <SaveConfirmation
          onClose={() => { setShowSave(false); setSelectedPost(null); }}
          onViewCollections={() => console.log('View collections')}
        />
      )}
      
      {showMore && selectedPost && (
        <MoreOptionsMenu
          post={selectedPost}
          onClose={() => { setShowMore(false); setSelectedPost(null); }}
          onAction={(action) => {
            showToast(`Action: ${action}`, 'info');
            setShowMore(false);
          }}
        />
      )}
      
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 400,
          width: '90%',
          padding: '12px 20px',
          background: COLORS.bgSecondary,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 10000,
          animation: 'slideUp 0.3s ease',
        }}>
          <span style={{
            fontSize: 18,
            color: toast.type === 'success' ? COLORS.success : COLORS.primary,
          }}>
            {toast.type === 'success' ? '✓' : 'ℹ️'}
          </span>
          <span style={{
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 500,
          }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 19. AUTH SCREEN
// ============================================================
const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const profile = await getDoc(doc(db, 'users', result.user.uid));
        onLogin({ id: result.user.uid, ...profile.data() });
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          username,
          email,
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
          level: 1,
          xp: 0,
          verified: false,
        });
        const profile = await getDoc(doc(db, 'users', result.user.uid));
        onLogin({ id: result.user.uid, ...profile.data() });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  
  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await getDoc(doc(db, 'users', result.user.uid));
      if (profile.exists()) {
        onLogin({ id: result.user.uid, ...profile.data() });
      } else {
        await setDoc(doc(db, 'users', result.user.uid), {
          username: result.user.displayName?.split(' ')[0]?.toLowerCase() || 'user',
          email: result.user.email,
          avatarUrl: result.user.photoURL,
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
          level: 1,
          xp: 0,
          verified: false,
        });
        const newProfile = await getDoc(doc(db, 'users', result.user.uid));
        onLogin({ id: result.user.uid, ...newProfile.data() });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      background: COLORS.bg,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            background: COLORS.gradient1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 32,
          }}>
            🚀
          </div>
          <h1 style={{
            color: COLORS.text,
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 4,
          }}>Welcome</h1>
          <p style={{
            color: COLORS.textSecondary,
            fontSize: 14,
          }}>
            {isLogin ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>
        
        {error && (
          <div style={{
            padding: '10px 14px',
            background: `${COLORS.danger}22`,
            border: `1px solid ${COLORS.danger}44`,
            borderRadius: 12,
            color: COLORS.danger,
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}
        
        {!isLogin && (
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: COLORS.bgSecondary,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              color: COLORS.text,
              fontSize: 14,
              outline: 'none',
              marginBottom: 10,
            }}
          />
        )}
        
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: COLORS.bgSecondary,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            color: COLORS.text,
            fontSize: 14,
            outline: 'none',
            marginBottom: 10,
          }}
        />
        
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: COLORS.bgSecondary,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            color: COLORS.text,
            fontSize: 14,
            outline: 'none',
            marginBottom: 16,
          }}
        />
        
        <button
          onClick={handleAuth}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 0',
            background: COLORS.gradient1,
            border: 'none',
            borderRadius: 24,
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            marginBottom: 12,
          }}
        >
          {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
        </button>
        
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 0',
            background: 'white',
            border: 'none',
            borderRadius: 24,
            color: '#333',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textTertiary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};
