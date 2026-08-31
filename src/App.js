import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  Sun, Moon, Settings, Send, Mic, MicOff, FileUp, FlaskConical,
  ShieldCheck, Sparkles, Beaker, Check, ChevronRight,
  BrainCircuit, FileText, Fingerprint, Lock, ActivitySquare,
  Microscope, Atom, Trash2,
  Menu, X, MessageSquare, Plus
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- PERFORMANCE OPTIMIZATION 1: Move heavy functions outside the render cycle ---
const renderHighlightedText = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <span
          key={index}
          className="group relative inline-flex items-center gap-1.5 font-bold mx-1 my-0.5 px-2 sm:px-3 py-0.5 rounded-lg transition-all duration-500 hover:scale-105 cursor-default overflow-hidden border border-teal-500/30"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-indigo-500/20 to-teal-500/10 animate-gradient-x opacity-80 group-hover:opacity-100 transition-opacity"></span>
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="relative z-10 text-teal-800 dark:text-teal-300 drop-shadow-sm group-hover:text-teal-900 dark:group-hover:text-teal-100 transition-colors">
            {part}
          </span>
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

// --- PERFORMANCE OPTIMIZATION 2: Move heavy backgrounds ---
const AmbientBackground = memo(({ theme, isTyping }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 gpu-accelerated">
    <div className={`absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] ${theme === 'dark' ? 'opacity-30' : 'opacity-50'}`}></div>
    <div
      className="absolute inset-0 transition-all duration-[2000ms] ease-in-out origin-center gpu-accelerated"
      style={{
        filter: isTyping ? 'hue-rotate(150deg) saturate(1.4) brightness(1.1)' : 'hue-rotate(0deg) saturate(1) brightness(1)',
        transform: isTyping ? 'scale(1.05)' : 'scale(1)'
      }}
    >
      <div className={`absolute -top-[10%] -left-[10%] w-[80vw] h-[80vw] sm:w-[60vw] sm:h-[60vw] rounded-full mix-blend-screen filter blur-[80px] sm:blur-[100px] opacity-40 animate-blob ${theme === 'dark' ? 'bg-[#1E1B4B]' : 'bg-indigo-200/60'}`}></div>
      <div className={`absolute top-[20%] -right-[10%] w-[70vw] h-[70vw] sm:w-[50vw] sm:h-[50vw] rounded-full mix-blend-screen filter blur-[100px] sm:blur-[120px] opacity-40 animate-blob animation-delay-2000 ${theme === 'dark' ? 'bg-[#064E3B]' : 'bg-teal-200/60'}`}></div>
      <div className={`absolute -bottom-[20%] left-[20%] w-[90vw] h-[90vw] sm:w-[70vw] sm:h-[70vw] rounded-full mix-blend-screen filter blur-[100px] sm:blur-[120px] opacity-30 animate-blob animation-delay-4000 ${theme === 'dark' ? 'bg-[#3B0764]' : 'bg-purple-200/50'}`}></div>
    </div>
    <div className={`absolute inset-0 opacity-[0.04] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] ${theme === 'dark' ? 'invert' : ''}`}></div>
    {theme === 'dark' && (
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_30%,#000_100%)] opacity-70 z-10 mix-blend-multiply pointer-events-none"></div>
    )}
  </div>
));

const GlobalFlashlight = memo(({ theme, isTyping }) => {
  const lightCoreDark = isTyping ? 'rgba(236, 72, 153, 0.20)' : 'rgba(45, 212, 191, 0.15)';
  const lightSpreadDark = isTyping ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255, 255, 255, 0.04)';
  const lightCoreLight = isTyping ? 'rgba(236, 72, 153, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  return (
    <div
      className="fixed inset-0 z-[50] pointer-events-none transition-all duration-[2000ms] ease-in-out gpu-accelerated"
      style={{
        background: theme === 'dark'
          ? `radial-gradient(circle calc(min(70vw, 300px) * var(--flash-scale, 1)) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), ${lightCoreDark}, transparent 60%),
             radial-gradient(circle calc(min(150vw, 800px) * var(--flash-scale, 1)) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), ${lightSpreadDark}, transparent 60%)`
          : `radial-gradient(circle calc(min(90vw, 400px) * var(--flash-scale, 1)) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), ${lightCoreLight}, transparent 60%)`,
        mixBlendMode: theme === 'dark' ? 'color-dodge' : 'color-burn'
      }}
    />
  );
});

// --- GLOBAL WHATSAPP SECURE SHARE LOGIC ---
const triggerGlobalWhatsAppShare = (highlights, fullAnalysis, patientName = "") => {
  try {
    let whatsappText = `🏥 *LABXPLORE NEURAL AI - REFERRED REPORT SUMMARY*\n`;
    whatsappText += `====================================\n\n`;

    if (patientName) {
      whatsappText += `👤 *Patient Name:* ${patientName}\n\n`;
    }

    if (highlights && highlights.length > 0) {
      whatsappText += `🚨 *KEY HIGHLIGHTS:*\n`;
      highlights.forEach((item) => {
        const typeLower = item.type ? item.type.toLowerCase() : '';
        const emoji = typeLower === 'critical' || typeLower === 'alert' ? '🔴' : typeLower === 'warning' || typeLower === 'important' ? '🟡' : '🟢';
        whatsappText += `${emoji} *${item.title}:* ${item.description}\n\n`;
      });
      whatsappText += `====================================\n\n`;
    }

    whatsappText += `📝 *DETAILED MEDICAL ANALYSIS:*\n`;
    const cleanAnalysis = fullAnalysis
      .replace(/### /g, '🔹 ')
      .replace(/## /g, '📌 ')
      .replace(/\*\*/g, '*')
      .substring(0, 1000);

    whatsappText += cleanAnalysis + `...\n`;

    const encodedText = encodeURIComponent(whatsappText);
    
    // 🔒 Phone number completely removed so it opens user's own WhatsApp chat selector
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  } catch (error) {
    console.error("WhatsApp integration failed:", error);
  }
};

// --- CORE RENDER PARSER LOGIC FOR CARDS & WHATSAPP BUTTON ---
const renderMessageText = (msg) => {
  if (!msg || !msg.text) return "";

  let highlights = [];
  let fullAnalysis = msg.text;
  let isStructured = false;

  try {
    if (msg.text.trim().startsWith('{')) {
      const parsedData = JSON.parse(msg.text);
      if (parsedData.highlights && parsedData.full_analysis) {
        highlights = parsedData.highlights;
        fullAnalysis = parsedData.full_analysis;
        isStructured = true;
      }
    }
  } catch (e) {
    console.log("JSON dynamic fallback checker triggered.");
  }

  if (!isStructured && msg.id > 1) {
    const textLower = msg.text.toLowerCase();
    const isScopeAlert = textLower.includes("scope restriction") || textLower.includes("restricted");

    if (isScopeAlert) {
      // noop
    } else if (textLower.includes("kam") || textLower.includes("low") || textLower.includes("critical")) {
      highlights.push({
        type: "critical",
        title: "🚨 CRITICAL ALERT",
        description: "Report contains values that are out of the normal biological reference range."
      });
    } else if (msg.text.length > 100 && !msg.text.includes("System active")) {
      const isActualReportResponse = msg.text.includes("TREND TRACKER") || msg.text.includes("Biomarker") || msg.text.includes("Report");
      if (isActualReportResponse) {
        highlights.push({
          type: "normal",
          title: "✅ REPORT ANALYZED",
          description: "Biomarker scanning complete. Tap the button below to instantly share this with us."
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {highlights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 w-full">
          {highlights.map((highlight, index) => {
            const typeLower = highlight.type ? highlight.type.toLowerCase() : '';
            const isCritical = typeLower === 'critical' || typeLower === 'alert';
            const isWarning = typeLower === 'warning' || typeLower === 'important';
            const isNormal = typeLower === 'normal';

            return (
              <div
                key={index}
                className={`p-4 rounded-xl backdrop-blur-md border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${isCritical ? 'bg-red-500/20 border-red-500/40 shadow-sm' :
                  isWarning ? 'bg-amber-500/20 border-amber-500/40 shadow-sm' :
                    isNormal ? 'bg-emerald-500/20 border-emerald-500/40 shadow-sm' :
                      'bg-blue-500/20 border-blue-500/40 shadow-sm'
                  }`}
                onClick={() => alert(`📌 Highlight Details:\n${highlight.description}`)}
              >
                <div className={`flex items-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider mb-1.5 ${isCritical ? 'text-red-900 dark:text-red-400' :
                  isWarning ? 'text-amber-900 dark:text-amber-400' :
                    isNormal ? 'text-emerald-900 dark:text-emerald-400' :
                      'text-blue-900 dark:text-blue-400'
                  }`}>
                  <span>{isCritical ? '🚨' : isWarning ? '⚠️' : isNormal ? '✅' : 'ℹ️'}</span>
                  {highlight.title}
                </div>
                <p className={`text-xs font-bold leading-relaxed ${isCritical ? 'text-red-950 dark:text-red-200' :
                  isWarning ? 'text-amber-950 dark:text-amber-200' :
                    isNormal ? 'text-emerald-950 dark:text-emerald-200' :
                      'text-blue-950 dark:text-blue-200'
                  }`}>
                  {highlight.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => <h1 className="text-2xl font-black mt-4 mb-2 text-slate-900 dark:text-white" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-3 mb-1 text-teal-700 dark:text-teal-300" {...props} />,
          p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3 space-y-1.5 marker:text-teal-500" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-3 space-y-1.5 marker:text-teal-500" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-teal-800 dark:text-teal-400 bg-teal-500/10 px-1 rounded-md" {...props} />
        }}
      >
        {fullAnalysis}
      </ReactMarkdown>

      <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
        <button
          onClick={() => triggerGlobalWhatsAppShare(highlights, fullAnalysis)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold tracking-wide transition-all active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <span>💬</span> Share Report via WhatsApp
        </button>
      </div>
    </div>
  );
};

// --- PERFORMANCE OPTIMIZATION 3: Memoize Individual Chat Messages ---
const ChatMessage = memo(({ msg, index }) => (
  <div
    className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} group animate-message-enter gpu-accelerated`}
    style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
  >
    <div className={`flex max-w-[90%] sm:max-w-[85%] md:max-w-[75%] gap-2 sm:gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-xl border transition-all duration-500 group-hover:scale-110 group-hover:shadow-2xl
        ${msg.sender === 'user'
          ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700/50 dark:from-white dark:to-slate-200 dark:text-slate-900 dark:border-white/20'
          : 'bg-[#0f172a] text-white border-teal-500/30'}`}>
        {msg.sender === 'user' ? (
          <span className="text-[10px] sm:text-xs font-black tracking-widest pointer-events-none">USR</span>
        ) : (
          <>
            <div className="absolute inset-0 rounded-full border border-teal-500/30 animate-[spin_4s_linear_infinite] pointer-events-none"></div>
            <div className="absolute inset-1 rounded-full border-t border-indigo-400/50 animate-[spin_3s_linear_infinite_reverse] pointer-events-none"></div>
            <Beaker className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 text-teal-400 pointer-events-none" />
          </>
        )}
      </div>

      <div className={`relative px-4 py-3 sm:px-6 sm:py-4 shadow-lg text-[14px] sm:text-[15px] leading-relaxed transition-all duration-300 group-hover:-translate-y-1
        ${msg.sender === 'user'
          ? 'text-white rounded-[1.2rem] sm:rounded-[1.5rem] rounded-tr-[0.25rem] bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-500 dark:to-purple-600 border border-white/10 shadow-[0_10px_30px_rgba(79,70,229,0.2)]'
          : 'text-slate-800 dark:text-slate-200 rounded-[1.2rem] sm:rounded-[1.5rem] rounded-tl-[0.25rem] bg-white/70 dark:bg-[#1e293b]/60 backdrop-blur-xl border border-white/40 dark:border-white/10'}`}
      >
        

        {msg.isFile ? (
          <div className="flex items-center gap-3 sm:gap-4 bg-black/10 dark:bg-black/20 p-2.5 sm:p-3.5 rounded-xl border border-white/10 backdrop-blur-sm pointer-events-none">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-lg shadow-inner">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-700 dark:text-indigo-300" />
            </div>
            <span className="font-semibold truncate flex-1 tracking-tight text-xs sm:text-sm">{msg.text.replace('Uploaded Document: ', '')}</span>
            <div className="p-1 sm:p-1.5 bg-emerald-500/20 rounded-full shadow-inner">
              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
        ) : (
          msg.sender === 'ai' || msg.sender === 'model' ? (
            renderMessageText(msg)
          ) : (
            <span className="whitespace-pre-wrap">{msg.text}</span>
          )
        )}
      </div>
    </div>
  </div>
));

const TypingIndicator = memo(() => (
  <div className="flex w-full justify-start animate-message-enter gpu-accelerated">
    <div className="flex gap-2 sm:gap-4">
      <div className="relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-[#0f172a] text-white flex items-center justify-center shadow-xl border border-fuchsia-500/50 transition-colors duration-1000">
        <div className="absolute inset-0 rounded-full bg-fuchsia-500/20 animate-ping"></div>
        <Atom className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 text-fuchsia-400 animate-[spin_3s_linear_infinite]" />
      </div>
      <div className="px-4 py-3 sm:px-6 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] rounded-tl-[0.25rem] bg-white/70 dark:bg-[#1e293b]/60 border border-fuchsia-500/30 backdrop-blur-xl flex items-center shadow-[0_0_20px_rgba(217,70,239,0.15)] transition-all duration-1000">
        <div className="flex items-center gap-1 sm:gap-1.5 h-3 sm:h-4">
          <div className="w-1 bg-fuchsia-400 rounded-full animate-waveform" style={{ animationDuration: '0.8s' }}></div>
          <div className="w-1 bg-purple-400 rounded-full animate-waveform" style={{ animationDuration: '1.2s' }}></div>
          <div className="w-1 bg-indigo-400 rounded-full animate-waveform" style={{ animationDuration: '0.9s' }}></div>
          <div className="w-1 bg-fuchsia-400 rounded-full animate-waveform" style={{ animationDuration: '1.1s' }}></div>
          <span className="ml-2 text-[10px] sm:text-xs font-bold text-fuchsia-400 uppercase tracking-widest animate-pulse transition-colors duration-1000">Processing</span>
        </div>
      </div>
    </div>
  </div>
));

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authFormData, setAuthFormData] = useState({ username: '', password: '', role: 'patient' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [userRole, setUserRole] = useState('patient');
  const [patientQueue, setPatientQueue] = useState(() => {
    const localData = localStorage.getItem('labxplore_queue');
    return localData ? JSON.parse(localData) : [];
  });
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionSupported = window.SpeechRecognition || window.webkitSpeechRecognition;
  const [appState, setAppState] = useState('reveal');
  const [theme, setTheme] = useState('dark');
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [userTypingPulse, setUserTypingPulse] = useState(false);
  const typingTimeoutRef = useRef(null);

  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isTyping, setIsTyping] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([{ id: "default_session", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("default_session");

  const messages = chatSessions.find(chat => chat.id === activeChatId)?.messages || [];

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  const mainScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const settingsRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const appStateRef = useRef(appState);

  const setMessages = useCallback((newMessagesFunc) => {
    setChatSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeChatId) {
        const updatedMsgs = typeof newMessagesFunc === 'function' ? newMessagesFunc(session.messages) : newMessagesFunc;
        return { ...session, messages: updatedMsgs };
      }
      return session;
    }));
  }, [activeChatId]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    localStorage.setItem('labxplore_queue', JSON.stringify(patientQueue));
  }, [patientQueue]);

  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        const res = await fetch("https://labxplore.onrender.com/sessions");
        const data = await res.json();
        const newFreshId = "session_" + Date.now();
        const newBlankSession = { id: newFreshId, messages: [] };

        if (data.sessions && data.sessions.length > 0) {
          const formattedSessions = data.sessions.map(s => ({
            id: s.id,
            title: s.title || 'LabXplore Analysis',
            messages: (s.messages || []).map((msg, idx) => ({
              id: idx,
              sender: msg.sender === 'model' ? 'ai' : msg.sender,
              text: msg.text || ''
            }))
          }));
          setChatSessions([newBlankSession, ...formattedSessions]);
        } else {
          setChatSessions([newBlankSession]);
        }
        setActiveChatId(newFreshId);
      } catch (error) {
        console.error("Sidebar load error:", error);
      }
    };
    fetchAllSessions();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`https://labxplore.onrender.com/history/${activeChatId}`);
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          const formattedHistory = data.history.map((msg, idx) => ({
            id: idx,
            sender: msg.sender === 'model' ? 'ai' : msg.sender,
            text: msg.text
          }));
          setChatSessions(prev => prev.map(session =>
            session.id === activeChatId ? { ...session, messages: formattedHistory } : session
          ));
        }
      } catch (error) {
        console.error("History fetch error:", error);
      }
    };
    if (activeChatId) fetchHistory();
  }, [activeChatId]);

  const handleNewChat = () => {
    const newId = "session_" + Date.now();
    setChatSessions(prev => [{ id: newId, messages: [] }, ...prev]);
    setActiveChatId(newId);
    setIsSidebarOpen(false);
  };

  const handleSwitchChat = (id) => {
    setActiveChatId(id);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;

    document.documentElement.style.setProperty('--mouse-x', `${currentX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${currentY}px`);

    const updatePosition = (x, y) => {
      mouseX = x;
      mouseY = y;
    };

    const handleMouseMove = (e) => updatePosition(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    let rafId;
    const animateFlashlight = () => {
      const currentTime = Date.now();
      const timeSec = currentTime * 0.001;
      const elapsedSec = (currentTime - startTimeRef.current) / 1000;

      const flashScale = 1 + Math.sin(timeSec * 2.0) * 0.2;
      const flashHue = (timeSec * 120) % 360;

      let revealExpand = 0;

      if (appStateRef.current === 'reveal') {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        if (elapsedSec < 3.5) {
          const radiusX = Math.min(window.innerWidth * 0.35, 350);
          const radiusY = Math.min(window.innerHeight * 0.22, 140);

          currentX = centerX + Math.cos(timeSec * 2.5) * radiusX;
          currentY = centerY + Math.sin(timeSec * 2.5) * radiusY;

          mouseX = currentX;
          mouseY = currentY;
        } else {
          currentX += (centerX - currentX) * 0.12;
          currentY += (centerY - currentY) * 0.12;
          mouseX = currentX;
          mouseY = currentY;

          const expandProgress = Math.min((elapsedSec - 3.5) / 1.5, 1);
          const ease = expandProgress < 0.5
            ? 4 * expandProgress * expandProgress * expandProgress
            : 1 - Math.pow(-2 * expandProgress + 2, 3) / 2;

          revealExpand = ease;
        }
      } else {
        currentX += (mouseX - currentX) * 0.15;
        currentY += (mouseY - currentY) * 0.15;
      }

      document.documentElement.style.setProperty('--mouse-x', `${currentX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${currentY}px`);
      document.documentElement.style.setProperty('--flash-scale', flashScale.toString());
      document.documentElement.style.setProperty('--flash-hue', flashHue.toString());
      document.documentElement.style.setProperty('--reveal-expand', revealExpand.toString());

      rafId = requestAnimationFrame(animateFlashlight);
    };
    rafId = requestAnimationFrame(animateFlashlight);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      setAppState('permission');
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mainScrollRef.current && appState === 'chat') {
      const container = mainScrollRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isTyping, appState]);

  useEffect(() => {
    if (appState === 'chat' && messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          id: 1,
          sender: 'ai',
          text: "System active. Welcome to **labXplore Neural AI**. I am engineered to decode complex clinical pathology. Upload a PDF or input biomarker data below to begin analysis."
        }]);
      }, 600);
    }
  }, [appState, messages.length]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    setUserTypingPulse(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setUserTypingPulse(false), 300);
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access issue detected.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
  };

  const captureAndUpload = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setIsTyping(true);
      stopCamera();
      const formData = new FormData();
      formData.append("file", new File([blob], "camera_snapshot.jpg", { type: "image/jpeg" }));

      try {
        const response = await fetch(`https://labxplore.onrender.com/upload?session_id=${activeChatId}&language=${selectedLanguage}`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (data.response) {
          const extractedName = data.response.match(/(?:Patient Name|Name|Name:)\s*([A-Za-z\s]+)/i)?.[1]?.trim() || `Patient_${Date.now().toString().slice(-4)}`;
          const isReportCritical = data.response.toLowerCase().includes("low") || data.response.toLowerCase().includes("kam") || (data.highlights && data.highlights.some(h => h.type === 'critical'));

          const newPatientEntry = {
            id: Date.now(),
            name: extractedName,
            target: "Camera Live Snapshot",
            status: isReportCritical ? "Critical Alert" : "Normal",
            isCritical: isReportCritical,
            rawResponse: data.highlights && data.highlights.length > 0 ? JSON.stringify({ highlights: data.highlights, full_analysis: data.response }) : data.response
          };
          setPatientQueue(prev => [newPatientEntry, ...prev]);
        }
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: data.highlights && data.highlights.length > 0 ? JSON.stringify({ highlights: data.highlights, full_analysis: data.response }) : data.response
        }]);
      } catch (error) {
        console.error(error);
      } finally {
        setIsTyping(false);
      }
    }, "image/jpeg");
  };

  const toggleVoiceListen = () => {
    if (!speechRecognitionSupported) {
      alert("Speech Recognition is not supported in your browser. Please use Chrome or Edge!");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = selectedLanguage === 'Hindi' ? 'hi-IN' : selectedLanguage === 'Hinglish' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (!isListening) {
      setIsListening(true);
      recognition.start();
      recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        handleInputChange({ target: { value: speechToText } });
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      setIsListening(false);
      recognition.stop();
    }
  };

  const handleOpenPatientReport = (patientEntry) => {
    setUserRole('patient');
    setInputText(`Reviewing detailed record for ${patientEntry.name}`);
    setMessages([{ id: Date.now(), sender: 'ai', text: patientEntry.rawResponse }]);
  };

  const handleShareReport = (patient) => {
    let highlights = [];
    let fullAnalysis = patient.rawResponse || "";

    try {
      if (typeof fullAnalysis === 'string' && fullAnalysis.trim().startsWith('{')) {
        const parsed = JSON.parse(fullAnalysis);
        highlights = parsed.highlights || [];
        fullAnalysis = parsed.full_analysis || "";
      }
    } catch (e) {
      console.log("Error parsing rawResponse for sharing");
    }

    // Direct hamare global share function ko trigger karega patient name ke sath
    triggerGlobalWhatsAppShare(highlights, fullAnalysis, patient.name);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!authFormData.username.trim() || !authFormData.password.trim()) {
      setAuthError('Please fill in all fields.');
      setAuthLoading(false);
      return;
    }

    const endpoint = authMode === 'login' ? '/login' : '/register';
    try {
      const response = await fetch(`https://labxplore.onrender.com${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authFormData)
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.detail || data.error || 'Authentication failed.');
      }

      if (authMode === 'login') {

        // 🔒 SUPER SECURE BARRIER: Har type ke 'doctor' text variant ko check karega
        if (data && data.role && data.role.toLowerCase() === 'doctor') {
          const doctorSecretKey = "DR_NISHA_2026";
          const userEnteredKey = prompt("🔒 Enter Secure Clinical Clearance Passcode to access Doctor Terminal:");

          if (userEnteredKey !== doctorSecretKey) {
            alert("❌ Authentication Denied! Invalid Doctor Clearance Credentials.");
            setAuthLoading(false);
            return;
          }
        }

        // 🩺 Clear Passcode authentication workflow
        setCurrentUser({ username: data.username, role: data.role });
        setAuthFormData({ username: '', password: '', role: 'patient' });
        setAppState('chat');
      } else {
        alert("🎉 Account created securely! Please login now.");
        setAuthMode('login');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };
  const handleSendMessage = async (e) => {
  e?.preventDefault();

  if (!inputText.trim()) return;

  const userMessage = inputText.trim();

  const newMsg = {
    id: Date.now(),
    sender: 'user',
    text: userMessage
  };

  setMessages(prev => [...prev, newMsg]);
  setInputText('');
  setIsTyping(true);

  try {
    const response = await fetch(
      "https://labxplore.onrender.com/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: activeChatId.toString(),
          history: [...messages, newMsg].map(m => ({
            sender: m.sender === 'ai' ? 'model' : 'user',
            text: m.text
          })),
          message: userMessage,
          language: selectedLanguage
        })
      }
    );

    const data = await response.json();

    console.log("CHAT STATUS:", response.status);
    console.log("CHAT RESPONSE:", data);

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.error ||
        `Server error: ${response.status}`
      );
    }

    if (!data.response) {
      throw new Error("Gemini did not return a response.");
    }

    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.response
      }
    ]);

  } catch (error) {
    console.error("CHAT ERROR:", error);

    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        sender: 'ai',
        text: `⚠️ AI Error: ${error.message}`
      }
    ]);

  } finally {
    setIsTyping(false);
  }
};

  const handleClearChat = () => {
    setMessages([{
      id: 1,
      sender: 'ai',
      text: "System active. Welcome to **labXplore Neural AI**. I am engineered to decode complex clinical pathology. Upload a PDF or input biomarker data below to begin analysis."
    }]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: `Uploaded Document: ${file.name}`, isFile: true }]);
    setIsTyping(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`https://labxplore.onrender.com/upload?session_id=${activeChatId}&language=${selectedLanguage}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.response) {
        const extractedName = data.response.match(/(?:Patient Name|Name|Name:)\s*([A-Za-z\s]+)/i)?.[1]?.trim() || `Patient_${Date.now().toString().slice(-4)}`;
        const isReportCritical = data.response.toLowerCase().includes("low") || data.response.toLowerCase().includes("kam") || (data.highlights && data.highlights.some(h => h.type === 'critical'));

        const newPatientEntry = {
          id: Date.now(),
          name: extractedName,
          target: "Uploaded Diagnostic Document",
          status: isReportCritical ? "Critical Alert" : "Normal",
          isCritical: isReportCritical,
          rawResponse: data.highlights && data.highlights.length > 0 ? JSON.stringify({ highlights: data.highlights, full_analysis: data.response }) : data.response
        };

        // 🩺 State update karenge
        setPatientQueue(prev => {
          const updated = [newPatientEntry, ...prev];
          // 🔒 IMMEDIATE LOCK: Data ko turant local storage mein force write kar denge
          localStorage.setItem('labxplore_queue', JSON.stringify(updated));
          return updated;
        });
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.highlights && data.highlights.length > 0 ? JSON.stringify({ highlights: data.highlights, full_analysis: data.response }) : data.response
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (showSplash) {
    return (
      <div className="min-h-screen w-full bg-[#020617] relative overflow-hidden animate-reveal-fade cursor-pointer gpu-accelerated" onClick={() => setShowSplash(false)}>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none z-0 gpu-accelerated"></div>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-4 text-center">
          <Microscope className="w-16 h-16 text-teal-950 mb-6 sm:mb-8" style={{ stroke: 'rgba(45, 212, 191, 0.15)', strokeWidth: '1.5px' }} />
          <h1 className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter text-teal-950" style={{ WebkitTextStroke: '1px rgba(45, 212, 191, 0.12)' }}>labXplore</h1>
        </div>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 px-4 text-center transition-opacity duration-300 gpu-accelerated"
          style={{
            WebkitMaskImage: `radial-gradient(circle calc(230px * var(--flash-scale, 1) + (3500px * var(--reveal-expand, 0))) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), black 10%, transparent 80%)`,
            maskImage: `radial-gradient(circle calc(230px * var(--flash-scale, 1) + (3500px * var(--reveal-expand, 0))) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), black 10%, transparent 80%)`
          }}
        >
          <Microscope className="w-16 h-16 sm:w-24 sm:h-24 mb-6 sm:mb-8 text-teal-400 drop-shadow-[0_0_20px_rgba(45,212,191,0.7)]" style={{ strokeWidth: '2px', animation: 'float 3s ease-in-out infinite' }} />
          <h1 className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text drop-shadow-[0_0_35px_rgba(45,212,191,0.6)]" style={{ backgroundImage: 'linear-gradient(to right, #2dd4bf, #c084fc, #2dd4bf)', WebkitTextStroke: '1px rgba(255,255,255,0.7)' }}>labXplore</h1>
          <p className="text-teal-300 text-xs sm:text-sm font-bold tracking-[0.4em] uppercase mt-4 opacity-80 animate-pulse">Neural Engine Awakening</p>
        </div>

        <div className="absolute inset-0 pointer-events-none z-30 transition-all duration-300 gpu-accelerated" style={{ background: `radial-gradient(circle calc(280px * var(--flash-scale, 1) + (3500px * var(--reveal-expand, 0))) at var(--mouse-x, 50vw) var(--mouse-y, 50vh), transparent 0%, rgba(2, 6, 23, 0.96) 50%, #020617 100%)` }}></div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-pulse"><p className="text-white/20 text-xs tracking-[0.2em] uppercase font-bold">Click anywhere to skip</p></div>
      </div>
    );
  }

  if (appState === 'permission') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative z-50 overflow-hidden text-white">
        <AmbientBackground theme={theme} isTyping={isTyping} />
        <div className="max-w-lg w-full p-6 sm:p-10 rounded-[2.4rem] backdrop-blur-[40px] border bg-[#0f172a]/60 border-white/10 text-center shadow-2xl z-10 animate-scale-in">
          <Fingerprint className="w-14 h-14 mx-auto text-teal-400 mb-4 animate-pulse" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Identity & Consent</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">labXplore processes diagnostic files under temporary volatile logic streams securely.</p>
          <button onClick={() => setAppState('login_screen')} className="w-full py-4 bg-gradient-to-r from-teal-500 to-indigo-500 rounded-2xl text-white font-bold tracking-wide shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95 cursor-pointer">
            Authorize Neural Link
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'login_screen' && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden text-white fixed inset-0 z-[150]">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Username</label>
              <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white" value={authFormData.username} onChange={(e) => setAuthFormData({ ...authFormData, username: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input type="password" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white" value={authFormData.password} onChange={(e) => setAuthFormData({ ...authFormData, password: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Select Account Type</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-teal-500"
                value={authFormData.role}
                onChange={(e) => setAuthFormData({ ...authFormData, role: e.target.value })}
              >
                <option value="patient" className="bg-slate-900">Patient Terminal</option>
                <option value="doctor" className="bg-slate-900">Clinical Doctor</option>
              </select>
            </div>
            <button type="submit" disabled={authLoading} className="w-full py-3.5 px-4 rounded-xl bg-teal-500 text-slate-950 font-black">
              {authLoading ? 'Verifying Identity...' : authMode === 'login' ? 'SIGN IN' : 'REGISTER'}
            </button>
          </form>
          <div className="mt-8 text-center">
            <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="text-xs font-bold text-teal-400 cursor-pointer underline">
              {authMode === 'login' ? "Don't have an account? Sign up safely" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative transition-colors duration-700 selection:bg-teal-500/30 overflow-hidden ${theme === 'dark' ? 'dark bg-[#020617]' : 'bg-[#f8fafc]'}`}>
      <AmbientBackground theme={theme} isTyping={isTyping} />
      <GlobalFlashlight theme={theme} isTyping={isTyping} />

      <div className="flex flex-col flex-1 relative z-10 h-[100dvh]">
        {isSidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95]" onClick={() => setIsSidebarOpen(false)}></div>}

        {/* SIDEBAR CONTAINER */}
        <div className={`fixed inset-y-0 left-0 z-[100] w-[280px] sm:w-80 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border-r dark:border-white/10 shadow-2xl transition-transform duration-500 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b dark:border-white/10">
            <h2 className="font-black text-lg flex items-center gap-2 dark:text-white"><Menu className="w-5 h-5 text-teal-500" /> Chat History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4"><button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-500 text-white p-3.5 rounded-2xl font-bold shadow-md cursor-pointer"><Plus className="w-4 h-4" /> New Analysis</button></div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2 custom-scroll">
            {chatSessions.map(chat => (
              <button key={chat.id} onClick={() => handleSwitchChat(chat.id)} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeChatId === chat.id ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}>
                <MessageSquare className="w-4 h-4" /> <span className="truncate text-sm flex-1">{chat.messages.length > 0 ? chat.messages[0].text.slice(0, 20) : 'System Activated'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* APP HEADER BOX */}
        <div className="absolute top-2 sm:top-4 left-0 right-0 z-[90] px-2 sm:px-4 w-full max-w-5xl mx-auto pointer-events-none">
          <header className="pointer-events-auto flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl sm:rounded-3xl backdrop-blur-[40px] border transition-all duration-500 shadow-2xl shadow-black/5 bg-white/40 border-white/60 dark:bg-[#0f172a]/40 dark:border-white/10 dark:shadow-black/40 animate-slide-up-fade gpu-accelerated">
            <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
              <div className="relative">
                <div className={`absolute inset-0 rounded-xl blur-lg transition-all duration-1000 ${isTyping ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600 opacity-80' : 'bg-gradient-to-br from-teal-400 to-indigo-500 opacity-50 group-hover:opacity-100'}`}></div>
                <div className="relative p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white border border-white/20 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-indigo-500/20 group-hover:scale-150 transition-transform duration-700"></div>
                  <Microscope className={`w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-all duration-500 ${isTyping ? 'text-teal-400 scale-110' : 'group-hover:scale-110'}`} />
                </div>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-300 to-emerald-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)] pointer-events-none">
                labXplore
              </h1>
              <button
                type="button"
                onClick={() => setUserRole(userRole === 'patient' ? 'doctor' : 'patient')}
                className={`ml-2 sm:ml-4 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border transition-all duration-300 cursor-pointer ${userRole === 'doctor'
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                  : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                  }`}
              >
                Mode: {userRole}
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-transparent border border-slate-300/50 dark:border-white/10 rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 focus:outline-none focus:border-teal-500/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-all outline-none"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                <option value="English" className="bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white">EN</option>
                <option value="Hindi" className="bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white">HI</option>
                <option value="Hinglish" className="bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white">HG</option>
              </select>
              <div className="w-px h-4 sm:h-5 bg-slate-300 dark:bg-white/10 mx-0.5 sm:mx-1"></div>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10 transition-all duration-300 hover:scale-110 cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 pointer-events-none" /> : <Moon className="w-4 h-4 text-slate-600 pointer-events-none" />}
              </button>
              <div className="w-px h-4 sm:h-5 bg-slate-300 dark:bg-white/10 mx-0.5 sm:mx-1"></div>
              <button
                onClick={handleClearChat}
                className="p-1.5 sm:p-2 rounded-full text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-500/20 transition-all duration-300 hover:scale-110 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 pointer-events-none" />
              </button>
              <div className="w-px h-4 sm:h-5 bg-slate-300 dark:bg-white/10 mx-0.5 sm:mx-1"></div>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 sm:p-2 rounded-full text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20 transition-all duration-300 hover:scale-110 cursor-pointer"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none" />
              </button>
            </div>
          </header>
        </div>

        {userRole === 'patient' ? (
          <div className="w-full flex flex-col flex-1 relative overflow-hidden">
            <main ref={mainScrollRef} className="flex-1 overflow-y-auto px-4 pt-24 pb-32 w-full max-w-4xl mx-auto space-y-6 custom-scroll">
              {messages.map((msg, index) => (
                <ChatMessage key={msg.id} msg={msg} index={index} />
              ))}
              {isTyping && <TypingIndicator />}
            </main>

            {isCameraOpen && (
              <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-4 max-w-md w-full flex flex-col gap-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2 text-white font-bold">
                    <h3>📷 Camera Report Scanner</h3>
                    <button onClick={stopCamera}>✕</button>
                  </div>
                  <div className="overflow-hidden rounded-xl bg-black aspect-video relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={stopCamera} className="flex-1 py-2 bg-white/5 text-white rounded-xl">Cancel</button>
                    <button onClick={captureAndUpload} className="flex-1 py-2 bg-emerald-500 text-white font-bold rounded-xl shadow-lg">Capture & Scan</button>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-4 left-0 right-0 z-[90] px-4 pointer-events-none">
              <div className="max-w-3xl mx-auto pointer-events-auto relative">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-[#0f172a]/80 border border-white/10 p-2 rounded-[2rem] shadow-2xl">
                  <input type="file" accept=".pdf,.jpg,.png" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-teal-400 bg-white/5 rounded-full"><FileUp className="w-4 h-4" /></button>
                  <button type="button" onClick={startCamera} className="p-3 text-slate-400 hover:text-emerald-400 bg-white/5 rounded-full transition-all"><span className="text-base">📷</span></button>
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder="Inquire or paste diagnostic data..."
                    className="flex-1 bg-transparent text-white px-2 focus:outline-none placeholder-slate-500 mb-2"
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceListen}
                    className={`p-2.5 rounded-full transition-all duration-300 hover:scale-110 cursor-pointer ${isListening ? 'bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse' : 'text-slate-400 hover:text-teal-400 hover:bg-white/5'}`}
                  >
                    {isListening ? <MicOff className="w-4 h-4 text-red-500 pointer-events-none" /> : <Mic className="w-4 h-4 pointer-events-none" />}
                  </button>
                  <div className="w-px h-4 bg-slate-300 dark:bg-white/10 mx-1"></div>
                  <button type="submit" className="p-3 bg-white text-[#0f172a] rounded-full font-bold hover:scale-105 active:scale-95 transition-transform"><Send className="w-4 h-4" /></button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* 🩺 DOCTOR SECTION: Naya Glassmorphic Clinical Dashboard Layout */
          <div className="w-full max-w-5xl mx-auto px-4 pt-28 pb-12 overflow-y-auto h-[calc(100vh-100px)] text-left custom-scroll">

            {/* 🔒 DASHBOARD SECURITY LEVEL CHECK LAYER */}
            {currentUser?.role !== 'doctor' ? (
              <div className="mt-8 p-8 text-center rounded-3xl backdrop-blur-2xl bg-red-500/5 border border-red-500/20 shadow-2xl">
                <div className="text-4xl mb-3">🔒</div>
                <h2 className="text-lg font-black text-white mb-2">ACCESS RESTRICTED</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                  This terminal is encrypted for clinical doctors only. Please switch the profile back to patient mode from the header.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Box 1: Total Reports Reviewed */}
                  <div className="p-5 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Reports Reviewed</h3>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mt-2">
                      {patientQueue.length < 10 ? `0${patientQueue.length}` : patientQueue.length} Active
                    </p>
                    <span className="text-[10px] text-emerald-400 font-bold">↑ 12% This Week</span>
                  </div>

                  {/* Box 2: Critical Red Alerts */}
                  <div className="p-5 rounded-2xl backdrop-blur-xl bg-red-500/5 border border-red-500/20 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">Critical Red Alerts</h3>
                    <p className="text-3xl font-black text-red-400 mt-2">
                      {(() => {
                        const criticalCount = patientQueue.filter(p => p.isCritical).length;
                        return criticalCount < 10 ? `0${criticalCount}` : criticalCount;
                      })()} Cases
                    </p>
                    <span className="text-[10px] text-red-300 opacity-80">Requires Immediate Medical Action</span>
                  </div>

                  {/* Box 3: Active Hospital Ward (Dr. Nisha Fixed Profile) */}
                  <div className="p-5 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Hospital Ward</h3>
                    <p className="text-3xl font-black text-teal-400 mt-2 truncate max-w-[200px]">
                      Dr. Nisha
                    </p>
                    <span className="text-[10px] text-slate-400">Neural Engine Connected</span>
                  </div>
                </div>

                {/* 📋 PATIENT PATHOLOGY QUEUE REAL DATA TABLE */}
                <div className="mt-8 p-6 rounded-3xl backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl">
                  <h2 className="text-lg font-black tracking-tight text-white mb-4">Patient Pathology Queue</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <th className="pb-3">Patient Name</th>
                          <th className="pb-3">Report Target</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-semibold divide-y divide-white/5">
                        {patientQueue.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-slate-500 text-xs uppercase tracking-wider font-bold">
                              📭 No active pathology reports audited yet. Upload a report first!
                            </td>
                          </tr>
                        ) : (
                          patientQueue.map((patient) => (
                            <tr key={patient.id} className="text-slate-300 transition-colors hover:bg-white/5">
                              <td className="py-3.5 font-bold text-white">{patient.name}</td>
                              <td className="py-3.5 text-xs text-slate-400">{patient.target}</td>
                              <td className="py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${patient.isCritical ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                                  {patient.status}
                                </span>
                              </td>
                              <td className="py-3.5 text-right space-x-4">
                                <button type="button" className="text-xs font-bold text-teal-400 hover:underline cursor-pointer" onClick={() => handleOpenPatientReport(patient)}>Open Report</button>

                                {/* 🟢 NEW SECURE WHATSAPP SHARE BUTTON */}
                                <button type="button" className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer" onClick={() => handleShareReport(patient)}>
                                  🟢 Share
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 🎨 STYLES EMBEDDED SAFELY INSIDE THE MAIN WRAPPER */}
            <style dangerouslySetInnerHTML={{
              __html: `
            :root {
              --mouse-x: 50vw;
              --mouse-y: 50vh;
              --flash-scale: 1;
              --reveal-expand: 100%;
            }
            .logo-reveal-text, [class*="reveal"] {
              animation: reveal-fade 3.5s forwards ease-in-out !important;
              opacity: 1 !important;
              filter: blur(0px) !important;
            }

            @keyframes reveal-fade {
              0% { opacity: 0; filter: blur(8px); }
              40% { opacity: 0.5; }
              70% { opacity: 1; filter: blur(0px); }
              100% { opacity: 1; filter: blur(0px); mask-size: 300% 300%; -webkit-mask-size: 300% 300%; }
            }
            .custom-scroll::-webkit-scrollbar { width: 5px; }
            .custom-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 10px; }
            @keyframes waveform { 0%, 100% { height: 4px; } 50% { height: 14px; } }
            .animate-waveform { animation: waveform 1s infinite ease-in-out; }
          `}} />

          </div>
        )}
      </div>
    </div>
  );
}