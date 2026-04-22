"use client";

import { useState, useEffect, useRef, use } from "react";
import { supabase } from "../../lib/supabase";
import Navbar from "../../components/Navbar";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ChatPage({ params }) {
  // Extract id from params (with use() for React 18/Next.js 13+ params)
  const resolvedParams = use(params);
  const showId = resolvedParams.id;

  const [show, setShow] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Input states
  const [textInput, setTextInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentUser && showId) {
      fetchShowDetails();
      fetchMessages();

      const channel = supabase
        .channel(`chat-room-${showId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `show_id=eq.${showId}` }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(scrollToBottom, 50);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser, showId]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        // Find best username from metadata
        const userName = user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
        setCurrentUser({ ...user, display_name: userName });
    }
  }

  async function fetchShowDetails() {
    const { data } = await supabase.from("shows").select("*").eq("id", showId).single();
    if (data) setShow(data);
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("show_id", showId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    }
    setLoading(false);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!textInput.trim() && !fileInputRef.current?.files[0]) return;

    const file = fileInputRef.current?.files[0];
    let fileUrl = null;
    let fileName = null;

    try {
      if (file) {
        if (!file.type.startsWith('image/')) {
          toast.error("Please select an image file.");
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File excessively large (over 5MB).");
          return;
        }

        setUploading(true);
        const ext = file.name.split('.').pop();
        const path = `${currentUser.id}/${showId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(path);
        fileUrl = publicUrl;
        fileName = file.name;
        
        // Reset file input
        fileInputRef.current.value = "";
      }

      if (textInput.trim() || fileUrl) {
        const { error } = await supabase.from("chat_messages").insert([{
          show_id: showId,
          user_id: currentUser.id,
          user_name: currentUser.display_name,
          content: textInput.trim(),
          file_url: fileUrl,
          file_name: fileName
        }]);

        if (error) throw error;
      }
      
      setTextInput("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 flex flex-col pt-6 pb-20">
        {/* Chat Header */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-4 flex items-center gap-4 shadow-xl z-10">
          <Link href="/">
            <button className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black font-display tracking-tight text-white line-clamp-1">{show?.name || `Show #${showId}`}</h1>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mt-0.5">Team Communications</p>
          </div>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto pt-8 pb-4 space-y-6 scroll-smooth pr-2">
          {messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                 <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-700/50">
                    <svg className="w-8 h-8 text-indigo-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                 </div>
                 <p className="font-semibold text-sm">No messages yet.</p>
                 <p className="text-xs text-slate-600 mt-1">Be the first to say hello or drop a screenshot.</p>
             </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.user_id === currentUser?.id;
              const showName = idx === 0 || messages[idx-1].user_id !== msg.user_id;

              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {showName && !isMine && (
                    <span className="text-xs font-bold text-slate-500 mb-1 ml-2">{msg.user_name}</span>
                  )}
                  {showName && isMine && (
                    <span className="text-xs font-bold text-slate-600 mb-1 mr-2">You</span>
                  )}
                  
                  <div className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl md:rounded-3xl px-4 py-3 shadow-sm ${
                    isMine 
                      ? 'bg-indigo-600 text-white rounded-tr-sm border border-indigo-500' 
                      : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                  }`}>
                    {msg.file_url && (
                       <a href={msg.file_url} target="_blank" rel="noreferrer" className="block mb-2 group relative overflow-hidden rounded-xl border border-white/10 shadow-lg">
                           <img src={msg.file_url} alt={msg.file_name} className="w-full max-h-72 object-cover group-hover:scale-105 transition-transform duration-500" />
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                               <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                           </div>
                       </a>
                    )}
                    {msg.content && (
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium tracking-wide">
                        {msg.content}
                      </p>
                    )}
                    <div className={`text-[10px] font-semibold mt-2 flex items-center gap-1 opacity-70 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area (Fixed Bottom) */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 pb-safe pb-4 pt-3">
         <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
            <form onSubmit={handleSendMessage} className="flex items-end gap-3 rounded-3xl bg-slate-900 border border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all p-2 pr-3">
               
               <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
               </button>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />

               <textarea
                 value={textInput}
                 onChange={(e) => setTextInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     handleSendMessage(e);
                   }
                 }}
                 placeholder="Type a message or attach a screenshot..."
                 className="flex-1 bg-transparent border-none text-slate-200 focus:ring-0 resize-none py-3 px-2 max-h-32 min-h-[48px]"
                 rows={1}
               />

               <button 
                  type="submit"
                  disabled={uploading || (!textInput.trim() && !fileInputRef.current?.files?.length)}
                  className="p-3 text-white bg-indigo-600 hover:bg-indigo-500 rounded-full disabled:opacity-50 disabled:bg-slate-700 flex-shrink-0 transition-colors shadow-md shadow-indigo-600/20 active:scale-95 mb-0.5"
               >
                 {uploading ? (
                    <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                 ) : (
                    <svg className="w-6 h-6 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                 )}
               </button>
            </form>
         </div>
      </div>
    </div>
  );
}
