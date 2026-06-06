// ─── COMPLETE FIXED VideoCard - NO FLOATING BANNERS, JUST ACTION BUTTONS ───
const VideoCard = ({ video, isActive, onMessage, onCall, onAddToCart, onSendNotification, showToast, userCoins, onSpendCoins, onAddToWatchHistory, onSaveToWatchLater, onBlock, onMute, onReport }) => {
  const [liked, setLiked] = useLocalStorage(`liked_${video.id}`, false);
  const [saved, setSaved] = useLocalStorage(`saved_${video.id}`, false);
  const [followed, setFollowed] = useLocalStorage(`followed_${video.id}`, false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([ { id: 1, user: "maya.dxo", text: "this is so good! 🔥", likes: 234, time: "2h", avatar: "M" }, { id: 2, user: "jaxon_real", text: "amazing content!", likes: 89, time: "3h", avatar: "J" } ]);
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [showBuyOptions, setShowBuyOptions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => { if (isActive && videoRef.current) { videoRef.current.play().catch(e => console.log("Playback error:", e)); onAddToWatchHistory?.(video); } else if (videoRef.current) { videoRef.current.pause(); } }, [isActive]);

  const handleDoubleTap = (e) => { const now = Date.now(); if (now - lastTap.current < 300 && !liked) { setLiked(true); setLikeCount(c => c + 1); const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; const heart = document.createElement('div'); heart.innerHTML = '❤️'; heart.style.position = 'absolute'; heart.style.left = x + 'px'; heart.style.top = y + 'px'; heart.style.fontSize = '60px'; heart.style.pointerEvents = 'none'; heart.style.animation = 'heartBurst 0.8s ease-out forwards'; e.currentTarget.appendChild(heart); setTimeout(() => heart.remove(), 800); onSendNotification?.({ type: "like", from: "you", message: `liked @${video.user}'s video`, videoId: video.id }); } lastTap.current = now; };
  
  const toggleLike = () => { setLiked(l => { setLikeCount(c => l ? c - 1 : c + 1); return !l; }); if (!liked) onSendNotification?.({ type: "like", from: "you", message: `liked @${video.user}'s video`, videoId: video.id }); };
  
  const addComment = () => { if (!commentText.trim()) return; setComments([{ id: Date.now(), user: "you", text: commentText, likes: 0, time: "now", avatar: "Y" }, ...comments]); setCommentText(""); onSendNotification?.({ type: "comment", from: "you", message: `commented on @${video.user}'s video: "${commentText}"`, videoId: video.id }); showToast?.("Comment added!", "success"); };
  
  const sendGift = (gift) => { if (userCoins >= gift.price) { const id = Date.now(); setGiftAnimations([...giftAnimations, { ...gift, id }]); setTimeout(() => setGiftAnimations(prev => prev.filter(g => g.id !== id)), 3000); setShowGifts(false); onSpendCoins?.(gift.price); showToast?.(`Sent ${gift.name}!`, "success"); onSendNotification?.({ type: "gift", from: "you", message: `sent a ${gift.name} to @${video.user}`, videoId: video.id }); } else { showToast?.(`Not enough coins! Need ${gift.price} coins`, "error"); } };
  
  const handleBuy = () => { if (!video.forSale?.enabled) return; const item = { id: Date.now(), product: video.forSale.product, price: video.forSale.price, currency: video.forSale.currency, seller: video.user, image: video.forSale.image, quantity: quantity }; onAddToCart?.(item); showToast?.(`Added ${quantity} x ${video.forSale.product} to cart!`, "success"); setShowBuyOptions(false); setQuantity(1); };
  
  const handleSaveToWatchLater = () => { onSaveToWatchLater?.(video.id); showToast?.("Added to Watch Later!", "success"); setShowMoreMenu(false); };

  return ( <div style={{ width: "100%", height: "100%", position: "relative", background: video.bg, overflow: "hidden" }} onClick={handleDoubleTap}>
    <video ref={videoRef} src={video.videoUrl} loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {giftAnimations.map(gift => ( <div key={gift.id} style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", fontSize: 64, animation: `${gift.animation || 'heartBurst'} 1s ease-out forwards`, pointerEvents: "none", zIndex: 20 }}>{gift.icon}</div> ))}
    
    {/* BUY MODAL - ONLY POPUP, NO FLOATING BANNER */}
    {showBuyOptions && video.forSale?.enabled && ( 
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#1a1a1a", borderRadius: 20, padding: 20, zIndex: 30, width: "80%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{video.forSale.image}</div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{video.forSale.product}</div>
        <div style={{ color: "#ffd60a", fontSize: 24, fontWeight: 800, marginTop: 8 }}>{video.forSale.currency}{video.forSale.price}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>Stock: {video.forSale.stock} left</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 20, cursor: "pointer" }}>-</button>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{quantity}</span>
          <button onClick={() => setQuantity(Math.min(video.forSale.stock, quantity + 1))} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 20, cursor: "pointer" }}>+</button>
        </div>
        <button onClick={handleBuy} style={{ background: "#ff2d55", border: "none", borderRadius: 24, padding: "12px", color: "#fff", fontWeight: 800, marginTop: 16, width: "100%", cursor: "pointer" }}>Add to Cart - {video.forSale.currency}{(video.forSale.price * quantity).toFixed(2)}</button>
        <button onClick={() => setShowBuyOptions(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", marginTop: 8, cursor: "pointer" }}>Cancel</button>
      </div>
    )}
    
    {/* USER INFO - BOTTOM LEFT */}
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 70, padding: "0 14px 96px", background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <Avatar char={video.avatar} color={video.avatarColor} size={36} ring verified={video.verified} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>@{video.user}</div></div>
        <button onClick={() => setFollowed(f => !f)} style={{ padding: "5px 14px", borderRadius: 20, border: followed ? "1.5px solid rgba(255,255,255,0.4)" : "none", background: followed ? "transparent" : video.avatarColor, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{followed ? "Following" : "Follow"}</button>
      </div>
      <p style={{ fontSize: 13, color: "#fff", margin: "0 0 8px", lineHeight: 1.5, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{video.desc}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 13 }}>🎵</span><div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{video.song}</div></div>
    </div>
    
    {/* ACTION BUTTONS - RIGHT SIDE - CLEAN */}
    <div style={{ position: "absolute", right: 8, bottom: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}>
      <ActionBtn icon={liked ? "❤️" : "🤍"} count={formatNumber(likeCount)} active={liked} color="#ff2d55" onClick={toggleLike} />
      <ActionBtn icon="💬" count={formatNumber(video.comments)} onClick={() => setShowComments(true)} />
      <ActionBtn icon="↗️" count={formatNumber(video.shares)} onClick={() => { navigator.clipboard.writeText(video.videoUrl); showToast?.("Link copied!", "success"); }} />
      <ActionBtn icon={saved ? "🔖" : "🏷️"} count={formatNumber(video.saves)} active={saved} color="#ffd60a" onClick={() => setSaved(s => !s)} />
      <ActionBtn icon="✉️" onClick={() => onMessage?.(video)} />
      <ActionBtn icon="📞" onClick={() => onCall?.(video)} />
      <ActionBtn icon="🎁" onClick={() => setShowGifts(!showGifts)} />
      
      {/* 🛒 FOR SALE BUTTON - ICON ONLY, NO TEXT, NO BANNER */}
      {video.forSale?.enabled && (
        <button onClick={(e) => { e.stopPropagation(); setShowBuyOptions(true); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "5px 2px" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,216,10,0.1)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, border: "1px solid rgba(255,216,10,0.3)" }}>🛒</div>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>Buy</span>
        </button>
      )}
      
      <ActionBtn icon="⋯" onClick={() => setShowMoreMenu(!showMoreMenu)} />
    </div>
    
    {showMoreMenu && ( 
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: 150, right: 16, background: "rgba(0,0,0,0.95)", borderRadius: 16, padding: 8, zIndex: 30, width: 160 }}>
        <button onClick={handleSaveToWatchLater} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: "#fff", fontSize: 13, cursor: "pointer" }}>📌 Save to Watch Later</button>
        <button onClick={() => { onBlock?.(video.user, video.avatar, video.avatarColor); setShowMoreMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: "#ff2d55", fontSize: 13, cursor: "pointer" }}>🚫 Block @{video.user}</button>
        <button onClick={() => { onMute?.(video.user, video.avatar, video.avatarColor); setShowMoreMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: "#ffd60a", fontSize: 13, cursor: "pointer" }}>🔇 Mute @{video.user}</button>
        <button onClick={() => { onReport?.(video); setShowMoreMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: "#ff2d55", fontSize: 13, cursor: "pointer" }}>🚩 Report</button>
      </div>
    )}
    
    {showComments && ( 
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Comments ({comments.length})</span>
          <button onClick={() => setShowComments(false)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {comments.map(c => ( 
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{c.avatar || c.user[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>@{c.user}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{c.time}</span>
                </div>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>Y</div>
          <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "9px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
          <button onClick={addComment} style={{ background: commentText.trim() ? "#ff2d55" : "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 16, cursor: "pointer" }}>↑</button>
        </div>
      </div>
    )}
    
    {showGifts && ( 
      <div style={{ position: "absolute", bottom: 200, right: 16, background: "rgba(0,0,0,0.95)", borderRadius: 20, padding: 12, zIndex: 30 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {GIFTS.map(gift => ( 
            <button key={gift.id} onClick={() => sendGift(gift)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 8, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 24 }}>{gift.icon}</span>
              <span style={{ fontSize: 10, color: "#fff" }}>{gift.price}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div> );
};