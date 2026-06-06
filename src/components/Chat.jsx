import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scrolls the chat window down to the latest message smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Connect real-time socket listener to the global chat collection
  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      orderBy("createdAt", "asc"),
      limit(50) // Keep stream light for performance
    );

    // onSnapshot listens for database updates instantly
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(fetchedMessages);
      // Timeout ensures React finishes rendering elements before calculating heights
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      console.error("Chat sync stream dropped:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageData = {
      text: newMessage.trim(),
      userId: user.uid,
      username: user.email ? user.email.split("@")[0] : "anonymous",
      createdAt: serverTimestamp(),
    };

    setNewMessage(""); // Clear input bar immediately for rapid typing layout

    try {
      await addDoc(collection(db, "chats"), messageData);
    } catch (err) {
      console.error("Message delivery failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white pb-20">
      {/* Top Header Navigation Strip */}
      <div className="p-4 border-b border-gray-900 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <div>
          <h1 className="text-base font-bold">Global Live Room</h1>
          <p className="text-[10px] text-gray-400 font-medium">Chatting with creators around the world</p>
        </div>
      </div>

      {/* Messages Render Zone */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-none">
        {messages.map((msg) => {
          const isOwnMessage = user && msg.userId === user.uid;
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[75%] ${isOwnMessage ? "self-end items-end" : "self-start items-start"}`}
            >
              {/* Sender Name tag */}
              {!isOwnMessage && (
                <span className="text-[11px] text-gray-500 font-semibold mb-0.5 ml-2">
                  @{msg.username}
                </span>
              )}
              {/* Message Bubble Block */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm break-words shadow-md ${
                  isOwnMessage
                    ? "bg-red-500 text-white rounded-br-none"
                    : "bg-gray-900 text-gray-200 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        {/* Invisible anchor target layout parameter used by scroll anchor ref handler */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Typing Input Bar Box Container */}
      <div className="p-4 border-t border-gray-900 bg-gray-950/40 backdrop-blur-md">
        {user ? (
          <form onSubmit={handleSendMessage} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Send a live message..."
              className="flex-1 bg-gray-900 text-white p-3 rounded-xl text-sm px-4 border border-transparent focus:border-red-500 outline-none transition-colors"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center shadow-lg"
            >
              Send
            </button>
          </form>
        ) : (
          <div className="text-center py-2 text-sm text-gray-500 font-medium">
            Please navigate to your Profile to log in and unlock live chat streams.
          </div>
        )}
      </div>
    </div>
  );
}