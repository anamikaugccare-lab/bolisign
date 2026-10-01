'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Volume2, VolumeX, Sparkles, Mic, MicOff, PlusCircle, 
  BookOpen, UserCheck, Smartphone, CheckCircle, RefreshCw, AlertCircle,
  Copy, Trash2, RotateCcw, Check
} from 'lucide-react';
import { CustomSign } from '@/lib/types';

declare global {
  interface Window {
    Hands: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function BoliSignPage() {
  const [activeTab, setActiveTab] = useState<'interpret' | 'train' | 'reverse'>('interpret');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraErrorNotice, setCameraErrorNotice] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<string>('AI मॉडल लोड हो रहा है...');
  const [aiReady, setAiReady] = useState<boolean>(false);
  const [handsDetectedCount, setHandsDetectedCount] = useState<number>(0);
  
  // Audio state
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  // Detection state
  const [currentSign, setCurrentSign] = useState<string>('कैमरा के आगे हाथ लाएं...');
  const [confidence, setConfidence] = useState<number>(0);
  const [fingerStates, setFingerStates] = useState<string>('इंतज़ार कर रहे हैं...');
  const [sentenceTokens, setSentenceTokens] = useState<string[]>([]);
  const [fluentHindiSentence, setFluentHindiSentence] = useState<string>('');
  
  // Custom Signs State (College Employee data)
  const [allSigns, setAllSigns] = useState<CustomSign[]>([]);
  const [newSignHindi, setNewSignHindi] = useState<string>('');
  const [newSignEnglish, setNewSignEnglish] = useState<string>('');
  const [newSignCategory, setNewSignCategory] = useState<'college' | 'daily' | 'emergency'>('college');
  const [isRecordingSign, setIsRecordingSign] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [quickSignName, setQuickSignName] = useState<string>('');

  // Reverse Mode & Voice-to-Text Speech Recognition
  const [spokenHindiText, setSpokenHindiText] = useState<string>('हाँ, लाइब्रेरी दूसरे माले पर खुली है।');
  const [manualHindiInput, setManualHindiInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechNotice, setSpeechNotice] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Video file test mode
  const [isVideoFileMode, setIsVideoFileMode] = useState<boolean>(false);
  const [currentVideoName, setCurrentVideoName] = useState<string>('');

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSpokenSignRef = useRef<string>('');
  const lastSpokenTimeRef = useRef<number>(0);
  const lastSosTimeRef = useRef<number>(0);
  const recentDetectionsRef = useRef<string[]>([]);
  const latestRawLandmarksRef = useRef<any[] | null>(null);
  const latestFingerSignatureRef = useRef<any>(null);
  const lastStableLandmarksRef = useRef<any[] | null>(null);
  const lastStableSignatureRef = useRef<any>(null);
  const lastStableTimeRef = useRef<number>(0);
  const lockedPoseRef = useRef<{ landmarks: any[]; signature: any; name: string; label?: string } | null>(null);
  const [lockedPoseStatus, setLockedPoseStatus] = useState<string>('');
  const [lockedPoseInfo, setLockedPoseInfo] = useState<{ label: string; signature: any } | null>(null);
  const [liveGestureName, setLiveGestureName] = useState<string>('');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [poseCaptureNotice, setPoseCaptureNotice] = useState<string>('');

  const BASE_SIGN_IDS = ['sign-namaste', 'sign-paani', 'sign-madad', 'sign-haan', 'sign-nahi', 'sign-dhanyavaad', 'sign-doctor', 'sign-khana', 'sign-library', 'sign-attendance'];
  const customSigns = allSigns.filter(s => !BASE_SIGN_IDS.includes(s.id));
  const activeTabRef = useRef<'interpret' | 'train' | 'reverse'>('interpret');
  const customSignsRef = useRef<CustomSign[]>([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    customSignsRef.current = allSigns.filter(s => !BASE_SIGN_IDS.includes(s.id));
  }, [allSigns]);

  // 1. Load signs from database
  const loadSigns = async () => {
    try {
      const res = await fetch('/api/signs');
      const data = await res.json();
      if (data.signs) {
        setAllSigns(data.signs);
        customSignsRef.current = data.signs.filter((s: any) => !BASE_SIGN_IDS.includes(s.id));
      }
    } catch (err) {
      console.error('Error loading signs:', err);
    }
  };

  useEffect(() => {
    loadSigns();
  }, []);

  // 2. Mobile Speech Unlock & Text-to-Speech
  const unlockAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const test = new SpeechSynthesisUtterance('आवाज़ चालू है!');
      test.lang = 'hi-IN';
      test.rate = 1.0;
      window.speechSynthesis.speak(test);
      setAudioUnlocked(true);
      setVoiceEnabled(true);
    }
  };

  const speakHindi = (text: string) => {
    if (!voiceEnabled || !text) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hindiVoice) utterance.voice = hindiVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  // 2b. Hindi Speech Recognition (Voice-to-Text for Reverse Mode)
  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechNotice('⚠️ आपके ब्राउज़र में आवाज़ पहचान (Speech Recognition) उपलब्ध नहीं है। कृपया Google Chrome या Microsoft Edge का उपयोग करें।');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const rec = new SpeechRec();
      rec.lang = 'hi-IN'; // Indian Hindi
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setSpeechNotice('🔴 माइक चालू है... कृपया हिंदी में बोलें');
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = final || interim;
        if (text && text.trim()) {
          setSpokenHindiText(text);
          setSpeechNotice(`✓ पहचाना गया: "${text}"`);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechNotice('⚠️ माइक्रोफ़ोन अनुमति ब्लॉक है! कृपया ब्राउज़र एड्रेस बार में 🔒 या माइक आइकन पर क्लिक करके Microphone "Allow" करें।');
        } else if (event.error === 'no-speech') {
          setSpeechNotice('⚠️ आवाज़ सुनाई नहीं दी। दोबारा माइक दबाकर बोलें।');
        } else if (event.error === 'network') {
          setSpeechNotice('⚠️ नेटवर्क एरर: आवाज़ पहचान के लिए इंटरनेट आवश्यक है।');
        } else {
          setSpeechNotice(`माइक स्थिति: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
      unlockAudio();
    } catch (err: any) {
      console.error('Speech recognition start error:', err);
      setSpeechNotice('माइक शुरू करने में समस्या: ' + err.message);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setSpeechNotice('माइक बंद किया गया');
    setTimeout(() => setSpeechNotice(''), 3000);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const copyToClipboard = () => {
    if (!spokenHindiText) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(spokenHindiText);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // 3. Initialize MediaPipe Hands
  useEffect(() => {
    let checkInterval: any = null;

    const initMediaPipe = () => {
      if (typeof window === 'undefined' || !window.Hands) return;

      try {
        setAiStatus('MediaPipe मॉडल इनिशियलाइज़ हो रहा है...');
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0, // 0 is ultra fast on mobile phones/tablets
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(handleResults);
        handsRef.current = hands;
        setAiReady(true);
        setAiStatus('AI मॉडल तैयार है (Ready) ✅');
        if (checkInterval) clearInterval(checkInterval);
      } catch (err: any) {
        console.error('MediaPipe Init Error:', err);
        setAiStatus('MediaPipe लोड करने में त्रुटि आई');
      }
    };

    checkInterval = setInterval(() => {
      if (window.Hands && !handsRef.current) {
        initMediaPipe();
      }
    }, 400);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (handsRef.current) {
        try { handsRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  // 4. Robust Multi-Fallback Camera Start with Comprehensive Diagnostics
  const startCamera = async () => {
    try {
      setCameraErrorNotice('');
      setAiStatus('कैमरा शुरू हो रहा है...');

      // Check if navigator.mediaDevices and getUserMedia exist
      if (typeof window !== 'undefined' && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        const isNotLocalhost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        let msg = 'ब्राउज़र में कैमरा API (getUserMedia) उपलब्ध नहीं है।';
        if (isNotLocalhost) {
          msg = 'ब्राउज़र सुरक्षा नियम: मोबाइल या नेटवर्क IP (HTTP) पर ब्राउज़र कैमरा को ब्लॉक करता है। कृपया अपने लैपटॉप के ब्राउज़र में सीधे http://localhost:3000 खोलें, या HTTPS इस्तेमाल करें।';
        }
        setCameraErrorNotice(msg);
        setAiStatus('कैमरा एरर: localhost या HTTPS आवश्यक है');
        return;
      }

      let stream: MediaStream | null = null;

      // Tier 1: Front camera with ideal 640x480 resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (e1) {
        console.warn('Tier 1 constraint failed, trying Tier 2 (facingMode only)...', e1);
        try {
          // Tier 2: Basic user-facing camera without resolution constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
        } catch (e2) {
          console.warn('Tier 2 constraint failed, trying Tier 3 (universal video)...', e2);
          // Tier 3: Universal video fallback
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!stream) {
        throw new Error('कैमरा वीडियो स्ट्रीम प्राप्त नहीं हो सकी।');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.warn('video.play() warning:', playErr);
            }
            setCameraActive(true);
            setAiStatus('कैमरा लाइव है • हाथ सामने लाएं 🖐️');
            startProcessingLoop();
          }
        };
      }
      unlockAudio();
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      let userFriendlyMsg = 'कैमरा शुरू करने में समस्या आई: ' + (err.message || 'त्रुटि');

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMsg = '⚠️ कैमरा परमिशन ब्लॉक है! ब्राउज़र के URL बार में 🔒 या कैमरा आइकन पर क्लिक करें और Camera को "Allow" करें, फिर रिफ्रेश करें।';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyMsg = '⚠️ कोई वेबकैम/कैमरा नहीं मिला! कृपया अपना कैमरा कनेक्ट करें।';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendlyMsg = '⚠️ कैमरा किसी अन्य ऐप (जैसे Zoom, Teams, Meet या कैमरा ऐप) में व्यस्त है। कृपया उसे बंद करके दोबारा कोशिश करें।';
      } else if (err.name === 'OverconstrainedError') {
        userFriendlyMsg = '⚠️ कैमरा इस रिज़ॉल्यूशन को सपोर्ट नहीं कर रहा।';
      }

      setCameraErrorNotice(userFriendlyMsg);
      setAiStatus('कैमरा एरर: ' + (err.name || 'त्रुटि'));
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (e) {}
    }
    setCameraActive(false);
    setIsVideoFileMode(false);
    setCurrentVideoName('');
    setHandsDetectedCount(0);
    setAiStatus('कैमरा / वीडियो बंद है');
  };

  // Play pre-recorded or uploaded video file through MediaPipe AI
  const playDemoVideo = (srcUrl: string = '/demo1.mp4', name: string = 'demo1.mp4') => {
    try {
      setCameraErrorNotice('');
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        videoRef.current.src = srcUrl;
        videoRef.current.loop = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        videoRef.current.onloadedmetadata = async () => {
          if (videoRef.current) {
            try {
              await videoRef.current.play();
              setCameraActive(true);
              setIsVideoFileMode(true);
              setCurrentVideoName(name);
              setAiStatus(`🎬 वीडियो टेस्ट चालू है: ${name}`);
              startProcessingLoop();
            } catch (playErr) {
              console.error('Video play error:', playErr);
            }
          }
        };
      }
      unlockAudio();
    } catch (e: any) {
      alert('वीडियो लोड करने में समस्या: ' + e.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      playDemoVideo(url, file.name);
    }
  };

  // 5. Continuous Frame Processing Loop
  const startProcessingLoop = () => {
    const processFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && handsRef.current) {
        try {
          await handsRef.current.send({ image: videoRef.current });
        } catch (e) {
          // ignore dropped frames
        }
      }
      if (videoRef.current && !videoRef.current.paused) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };
    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  // 6. Draw Skeleton & Classify Gestures
  const handleResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the camera or video frame to canvas
    if (results.image) {
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandsDetectedCount(results.multiHandLandmarks.length);
      latestRawLandmarksRef.current = results.multiHandLandmarks[0];
      lastStableLandmarksRef.current = results.multiHandLandmarks[0];
      lastStableTimeRef.current = Date.now();

      for (const landmarks of results.multiHandLandmarks) {
        // Draw Skeleton Connections
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
            color: '#10b981',
            lineWidth: 4
          });
        }
        // Draw Keypoint Circles
        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, landmarks, {
            color: '#38bdf8',
            lineWidth: 2,
            radius: 5
          });
        }

        // Run Upgraded Geometric Classifier
        analyzeFingersAndClassify(landmarks, ctx, canvas.width, canvas.height);
      }
    } else {
      latestRawLandmarksRef.current = null;
      setHandsDetectedCount(0);
      setFingerStates('हाथ नहीं दिख रहा...');
    }
    ctx.restore();
  };

  // High-Precision Scale & Rotation Invariant Geometric Sign Classifier
  const analyzeFingersAndClassify = (lm: any[], ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const dist = (p1: any, p2: any) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const wrist = lm[0];
    const thumbCmc = lm[1];
    const thumbMcp = lm[2];
    const thumbIp = lm[3];
    const thumbTip = lm[4];

    const indexMcp = lm[5];
    const indexPip = lm[6];
    const indexDip = lm[7];
    const indexTip = lm[8];

    const middleMcp = lm[9];
    const middlePip = lm[10];
    const middleDip = lm[11];
    const middleTip = lm[12];

    const ringMcp = lm[13];
    const ringPip = lm[14];
    const ringDip = lm[15];
    const ringTip = lm[16];

    const pinkyMcp = lm[17];
    const pinkyPip = lm[18];
    const pinkyDip = lm[19];
    const pinkyTip = lm[20];

    // Reference Palm Scale (wrist to middle MCP) to make checks distance-invariant
    const palmSize = Math.max(dist(wrist, middleMcp), 0.05);

    // True Euclidean Joint Angle & Distance Invariant Finger Extension (No screen-Y dependencies!)
    // When a finger is curled into the palm, its tip is closer to the wrist/MCP than its PIP joint:
    const isIndexOpen = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.10 && dist(indexTip, indexMcp) > dist(indexPip, indexMcp) * 1.05;
    const isMiddleOpen = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.10 && dist(middleTip, middleMcp) > dist(middlePip, middleMcp) * 1.05;
    const isRingOpen = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.10 && dist(ringTip, ringMcp) > dist(ringPip, ringMcp) * 1.05;
    const isPinkyOpen = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.10 && dist(pinkyTip, pinkyMcp) > dist(pinkyPip, pinkyMcp) * 1.05;

    // Thumb extension & orientation
    const isThumbOpen = dist(thumbTip, wrist) > dist(thumbMcp, wrist) * 1.18 && dist(thumbTip, indexMcp) > palmSize * 0.38;
    const thumbPointsUp = thumbTip.y < thumbMcp.y && (wrist.y - thumbTip.y) > palmSize * 0.25;
    const thumbPointsDown = thumbTip.y > wrist.y && thumbTip.y > thumbMcp.y;

    // Pinch & Clustering
    const isIndexThumbPinch = dist(thumbTip, indexTip) < palmSize * 0.38;
    const isFoodPinch = dist(thumbTip, indexTip) < palmSize * 0.45 && dist(thumbTip, middleTip) < palmSize * 0.5 && dist(indexTip, middleTip) < palmSize * 0.45;

    // Proximity between index and middle:
    const indexMiddleApart = dist(indexTip, middleTip) > palmSize * 0.30;
    const indexMiddleTogether = dist(indexTip, middleTip) < palmSize * 0.28;

    // Global finger counts:
    const allFourOpen = isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen;
    const allFourClosed = !isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen;
    const openCount = (isIndexOpen ? 1 : 0) + (isMiddleOpen ? 1 : 0) + (isRingOpen ? 1 : 0) + (isPinkyOpen ? 1 : 0);

    const stateDesc = `तर्जनी: ${isIndexOpen ? 'खुली' : 'मुड़ी'} | मध्यमा: ${isMiddleOpen ? 'खुली' : 'मुड़ी'} | अनामिका: ${isRingOpen ? 'खुली' : 'मुड़ी'} | कनिष्ठिका: ${isPinkyOpen ? 'खुली' : 'मुड़ी'}`;
    setFingerStates(stateDesc);

    let gestureSummary = '';
    if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen) {
      gestureSummary = '✌️ २ उंगलियां (तर्जनी + मध्यमा)';
    } else if (isIndexOpen && isMiddleOpen && isRingOpen && !isPinkyOpen) {
      gestureSummary = '३ उंगलियां (W आकार)';
    } else if (isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
      gestureSummary = '☝️ १ उंगली (तर्जनी)';
    } else if (allFourOpen) {
      gestureSummary = '✋ खुला हाथ (नमस्ते)';
    } else if (allFourClosed && (isThumbOpen || thumbPointsUp)) {
      gestureSummary = '👍 अंगूठा ऊपर (हाँ)';
    } else if (allFourClosed) {
      gestureSummary = '✊ मुट्ठी';
    } else {
      gestureSummary = `${openCount} उंगलियां खुली`;
    }
    setLiveGestureName(gestureSummary);

    // Save live finger signature snapshot for custom sign training
    const currentSig = {
      thumb: isThumbOpen,
      index: isIndexOpen,
      middle: isMiddleOpen,
      ring: isRingOpen,
      pinky: isPinkyOpen,
      thumbPointsUp,
      isPinch: isIndexThumbPinch
    };
    latestFingerSignatureRef.current = currentSig;
    lastStableSignatureRef.current = currentSig;

    let detected = '';
    let conf = 0.95;

    // 0. Custom Hackathon / Employee Trained Signs (Checked FIRST for instant response using live Ref)
    const currentCustomSigns = customSignsRef.current.length > 0 ? customSignsRef.current : customSigns;
    if (currentCustomSigns.length > 0) {
      for (const sign of currentCustomSigns) {
        let isMatch = false;

        // Method A: Deterministic Finger Topology Signature (100% invariant to scale and rotation)
        if (sign.fingerSignature) {
          const sig = sign.fingerSignature;

          // Check if 4 main fingers match exactly:
          const fourFingersMatch = 
            Boolean(sig.index) === isIndexOpen &&
            Boolean(sig.middle) === isMiddleOpen &&
            Boolean(sig.ring) === isRingOpen &&
            Boolean(sig.pinky) === isPinkyOpen;

          if (fourFingersMatch) {
            // If sign is pinch-specific, verify pinch
            if (sig.isPinch && !isIndexThumbPinch) {
              isMatch = false;
            } else {
              isMatch = true;
            }
          }
        }

        // Method B: Normalized 21-Landmark Distance Check
        if (!isMatch && sign.landmarksSample && sign.landmarksSample.length === 21) {
          let diffSum = 0;
          for (let i = 0; i < 21; i++) {
            const currDx = (lm[i].x - wrist.x) / palmSize;
            const currDy = (lm[i].y - wrist.y) / palmSize;
            const currDz = (lm[i].z - wrist.z) / palmSize;

            const sampleDx = sign.landmarksSample[i][0];
            const sampleDy = sign.landmarksSample[i][1];
            const sampleDz = sign.landmarksSample[i][2];

            diffSum += Math.hypot(currDx - sampleDx, currDy - sampleDy, currDz - sampleDz);
          }
          const avgDiff = diffSum / 21;
          if (avgDiff < 0.60) {
            isMatch = true;
          }
        }

        if (isMatch) {
          detected = sign.nameHindi;
          break;
        }
      }
    }

    // 1. Shaka / SOS (🤙 मदद चाहिए / Emergency): Thumb + Pinky open, middle 3 curled, wide spread
    const isSosGesture = (isThumbOpen || thumbPointsUp) && isPinkyOpen && !isIndexOpen && !isMiddleOpen && !isRingOpen && dist(thumbTip, pinkyTip) > palmSize * 0.70;

    // 2. Thumbs Up (👍 हाँ / Yes): Thumb pointing up, fingers curled, Pinky MUST be closed
    const isThumbsUpGesture = thumbPointsUp && (isThumbOpen || dist(thumbTip, wrist) > dist(thumbMcp, wrist) * 1.10) &&
                              !isPinkyOpen && !isRingOpen &&
                              (allFourClosed || openCount <= 1) &&
                              (Date.now() - lastSosTimeRef.current > 1500);

    // 3. Thumbs Down (👎 नहीं / No): Thumb pointing down, fingers curled, Pinky closed
    const isThumbsDownGesture = thumbPointsDown && !isPinkyOpen && (allFourClosed || openCount <= 1) &&
                                (Date.now() - lastSosTimeRef.current > 1500);

    if (!detected) {
      if (isSosGesture) {
        detected = 'मदद चाहिए (SOS)';
        lastSosTimeRef.current = Date.now();
        // Purge any accidental 'हाँ' from the rolling voting buffer so it never reaches threshold
        recentDetectionsRef.current = recentDetectionsRef.current.filter(s => s !== 'हाँ');
      }
      else if (isThumbsUpGesture) {
        detected = 'हाँ';
      }
      else if (isThumbsDownGesture) {
        detected = 'नहीं';
      }
      // 4. Food / Hunger (🤌 खाना): All fingertips clustered together
      else if (isFoodPinch && !isRingOpen && !isPinkyOpen) {
        detected = 'खाना';
      }
      // 5. Water (💧 पानी): "W" 3-finger sign (Index + Middle + Ring open, Pinky closed) OR Pinch 🤏
      else if ((isIndexOpen && isMiddleOpen && isRingOpen && !isPinkyOpen) || (isIndexThumbPinch && !isMiddleOpen && !isRingOpen)) {
        detected = 'पानी';
      }
      // 6. College Library (✌️ लाइब्रेरी - V / Peace Sign): Index + Middle open & spread, Ring + Pinky closed
      else if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && indexMiddleApart) {
        detected = 'लाइब्रेरी (कॉलेज)';
      }
      // 7. Doctor (🩺 डॉक्टर): Index + Middle open together (checking pulse / medical gesture)
      else if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && indexMiddleTogether) {
        detected = 'डॉक्टर';
      }
      // 8. Attendance (☝️ अटेंडेंस): Index finger alone pointing UP
      else if (isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
        detected = 'अटेंडेंस';
      }
      // 9. Thank You (🙏 धन्यवाद): Flat hand salute or fingers closed together
      else if (allFourOpen && indexMiddleTogether && !isThumbOpen) {
        detected = 'धन्यवाद';
      }
      // 10. Namaste (✋ नमस्ते): Open palm, 4 or 5 fingers extended
      else if (allFourOpen || openCount >= 4) {
        detected = 'नमस्ते';
      }
    }

    if (detected) {
      // Draw detection badge directly on canvas
      ctx.fillStyle = 'rgba(16, 185, 129, 0.90)';
      ctx.roundRect ? ctx.roundRect(15, 15, 240, 48, 10) : ctx.fillRect(15, 15, 240, 48);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Outfit, sans-serif';
      ctx.fillText(`✓ ${detected}`, 30, 47);

      // Smooth Rolling Voting Buffer (tolerant to occasional dropped frames)
      const buffer = recentDetectionsRef.current;
      buffer.push(detected);
      if (buffer.length > 7) {
        buffer.shift();
      }

      // Count occurrences of 'detected' in recent frames
      const matchCount = buffer.filter(s => s === detected).length;

      // Threshold: 4 out of last 7 frames triggers recognition smoothly
      if (matchCount >= 4) {
        setCurrentSign(detected);
        setConfidence(conf);

        const now = Date.now();
        if (detected !== lastSpokenSignRef.current || now - lastSpokenTimeRef.current > 2500) {
          lastSpokenSignRef.current = detected;
          lastSpokenTimeRef.current = now;

          // If SOS is detected, prioritize it: cancel any current audio (like trailing 'हाँ') and remove accidental 'हाँ' token
          if (detected === 'मदद चाहिए (SOS)') {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            setSentenceTokens(prev => prev.filter(token => token !== 'हाँ'));
          }

          // Only announce detected signs via TTS in Interpret tab so Tab 2 training is quiet & peaceful
          if (activeTabRef.current === 'interpret') {
            speakHindi(detected);
            setSentenceTokens(prev => {
              if (!prev.includes(detected)) return [...prev, detected];
              return prev;
            });
          }
        }
      }
    }
  };

  // 7. Quick Simulation click for testing
  const handleQuickTest = (sign: string) => {
    setCurrentSign(sign);
    speakHindi(sign);
    setSentenceTokens(prev => {
      if (!prev.includes(sign)) return [...prev, sign];
      return prev;
    });
  };

  // 8. AI Sentence Generation
  const handleGenerateSentence = async () => {
    if (sentenceTokens.length === 0) return;
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: sentenceTokens })
      });
      const data = await res.json();
      if (data.fluentHindi) {
        setFluentHindiSentence(data.fluentHindi);
        speakHindi(data.fluentHindi);
      }
    } catch (err) {
      console.error('Error generating sentence:', err);
    }
  };

  // Instant 1-Click Pose Lock from Live Camera Feed
  const handleLockCurrentPose = () => {
    if (!cameraActive) {
      setPoseCaptureNotice('⚠️ कृपया पहले ऊपर "कैमरा ऑन करें" ताकि आपका हाथ दिख सके!');
      return;
    }
    const rawLm = latestRawLandmarksRef.current || lastStableLandmarksRef.current;
    const sig = latestFingerSignatureRef.current || lastStableSignatureRef.current;

    if (!rawLm || rawLm.length < 21 || !sig) {
      setPoseCaptureNotice('⚠️ कैमरे के सामने अपना हाथ लाएं और स्थिर रखें, फिर लॉक बटन दबाएं!');
      return;
    }

    let summary = '';
    if (sig.index && sig.middle && !sig.ring && !sig.pinky) summary = '✌️ २ उंगलियां (तर्जनी + मध्यमा)';
    else if (sig.index && sig.middle && sig.ring && !sig.pinky) summary = '३ उंगलियां (W आकार)';
    else if (sig.index && !sig.middle && !sig.ring && !sig.pinky) summary = '☝️ १ उंगली';
    else if (sig.index && sig.middle && sig.ring && sig.pinky) summary = '✋ खुला हाथ (सभी उंगलियां)';
    else if (!sig.index && !sig.middle && !sig.ring && !sig.pinky && (sig.thumb || sig.thumbPointsUp)) summary = '👍 अंगूठा';
    else if (!sig.index && !sig.middle && !sig.ring && !sig.pinky) summary = '✊ मुट्ठी';
    else {
      const openFingers = [];
      if (sig.index) openFingers.push('तर्जनी');
      if (sig.middle) openFingers.push('मध्यमा');
      if (sig.ring) openFingers.push('अनामिका');
      if (sig.pinky) openFingers.push('कनिष्ठिका');
      if (sig.thumb) openFingers.push('अंगूठा');
      summary = openFingers.length > 0 ? `${openFingers.join(' + ')} खुली` : 'हाथ पोज़';
    }

    lockedPoseRef.current = {
      landmarks: rawLm,
      signature: sig,
      name: newSignHindi.trim() || 'Custom Sign',
      label: summary
    };
    setLockedPoseStatus(`✅ पोज़ लॉक हो गया: ${summary}`);
    setLockedPoseInfo({ label: summary, signature: sig });
    setPoseCaptureNotice(`🔒 "${summary}" का पोज़ लॉक हो गया! अब आप आराम से नाम लिखकर नीचे 'सेव' दबाएं।`);
    speakHindi(`${summary} पोज़ लॉक हो गया!`);
  };

  const handleUnlockPose = () => {
    lockedPoseRef.current = null;
    setLockedPoseStatus('');
    setLockedPoseInfo(null);
    setPoseCaptureNotice('🔓 पोज़ अनलॉक हो गया। अब आप लाइव कैमरा या नया पोज़ ले सकते हैं।');
  };

  // 3-Second Pose Snapshot Countdown (Freeze / Lock Pose before typing)
  const handleCapturePoseCountdown = () => {
    if (!cameraActive) {
      setPoseCaptureNotice('⚠️ कृपया पहले "कैमरा ऑन करें" ताकि हाथ दिख सके!');
      setTimeout(() => setPoseCaptureNotice(''), 4000);
      return;
    }
    setCountdownSeconds(3);
    setPoseCaptureNotice('⏱️ हाथ का इशारा कैमरे के सामने रखें: ३...');

    setTimeout(() => {
      setCountdownSeconds(2);
      setPoseCaptureNotice('⏱️ हाथ का इशारा कैमरे के सामने रखें: २...');
    }, 1000);

    setTimeout(() => {
      setCountdownSeconds(1);
      setPoseCaptureNotice('⏱️ हाथ का इशारा कैमरे के सामने रखें: १...');
    }, 2000);

    setTimeout(() => {
      setCountdownSeconds(null);
      let lm = latestRawLandmarksRef.current;
      let sig = latestFingerSignatureRef.current;
      if (!lm || lm.length < 21) {
        lm = lastStableLandmarksRef.current;
        sig = lastStableSignatureRef.current;
      }

      if (lm && lm.length === 21) {
        let summary = '';
        if (sig.index && sig.middle && !sig.ring && !sig.pinky) summary = '✌️ २ उंगलियां (तर्जनी + मध्यमा)';
        else if (sig.index && sig.middle && sig.ring && !sig.pinky) summary = '३ उंगलियां (W आकार)';
        else if (sig.index && !sig.middle && !sig.ring && !sig.pinky) summary = '☝️ १ उंगली';
        else if (sig.index && sig.middle && sig.ring && sig.pinky) summary = '✋ खुला हाथ (सभी उंगलियां)';
        else summary = 'हाथ पोज़';

        lockedPoseRef.current = {
          landmarks: lm,
          signature: sig,
          name: newSignHindi.trim() || 'Custom Sign',
          label: summary
        };
        setLockedPoseStatus(`✅ पोज़ लॉक हो गया: ${summary}`);
        setLockedPoseInfo({ label: summary, signature: sig });
        setPoseCaptureNotice(`📸 "${summary}" पोज़ लॉक हो गया! अब आप आराम से नाम लिखकर "सेव" बटन दबा सकते हैं।`);
        speakHindi(`${summary} पोज़ लॉक हो गया!`);
      } else {
        setPoseCaptureNotice('⚠️ हाथ नहीं दिखा! कृपया कैमरे के सामने हाथ लाएं और दोबारा कोशिश करें।');
      }
    }, 3000);
  };

  // 9. Save Custom Sign (with Live Camera Pose or Locked Pose capture)
  const handleSaveSign = async () => {
    const nameH = newSignHindi.trim();
    if (!nameH) {
      setSaveStatus('⚠️ कृपया नए साइन का नाम लिखें (जैसे: फीस काउंटर, कैरम, कैंटीन)!');
      return;
    }

    if (!cameraActive) {
      setSaveStatus('⚠️ कैमरा अभी बंद है! कृपया ऊपर "कैमरा ऑन करें" ताकि AI आपके हाथ का पोज़ देख सके।');
      return;
    }

    // Determine landmarks and signature:
    // 1: Locked pose from 3s countdown snapshot
    // 2: Live detected landmarks right now
    // 3: Stable landmarks from last 8 seconds (e.g. while user typed on keyboard)
    let rawLm: any[] | null = null;
    let fingerSig: any = null;

    if (lockedPoseRef.current && lockedPoseRef.current.landmarks.length === 21) {
      rawLm = lockedPoseRef.current.landmarks;
      fingerSig = lockedPoseRef.current.signature;
    } else if (latestRawLandmarksRef.current && latestRawLandmarksRef.current.length === 21) {
      rawLm = latestRawLandmarksRef.current;
      fingerSig = latestFingerSignatureRef.current;
    } else if (lastStableLandmarksRef.current && (Date.now() - lastStableTimeRef.current < 8000)) {
      rawLm = lastStableLandmarksRef.current;
      fingerSig = lastStableSignatureRef.current;
    }

    if (!rawLm || rawLm.length < 21) {
      setSaveStatus('⚠️ कैमरे के सामने अपना हाथ लाएं और वह इशारा बनाकर रखें जो आप सिखाना चाहते हैं!');
      return;
    }

    setIsRecordingSign(true);
    setSaveStatus('डेटाबेस में सेव हो रहा है...');

    const wrist = rawLm[0];
    const palmSize = Math.max(Math.hypot(wrist.x - rawLm[9].x, wrist.y - rawLm[9].y), 0.05);
    const landmarksToSave = rawLm.map((p: any) => [
      (p.x - wrist.x) / palmSize,
      (p.y - wrist.y) / palmSize,
      (p.z - wrist.z) / palmSize
    ]);

    try {
      const res = await fetch('/api/signs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameHindi: nameH,
          nameEnglish: newSignEnglish.trim() || nameH,
          category: newSignCategory,
          landmarksSample: landmarksToSave,
          fingerSignature: fingerSig || latestFingerSignatureRef.current || null,
          recordedBy: 'College Employee'
        })
      });
      const data = await res.json();
      if (data.success) {
        const msg = `🎉 साइन "${nameH}" लाइव AI हाथ पोज़ के साथ सफलतापूर्वक सेव हो गया!`;
        setSaveStatus(msg);
        setPoseCaptureNotice(msg);
        speakHindi(`${nameH} साइन सीख लिया गया है!`);
        setNewSignHindi('');
        setNewSignEnglish('');
        lockedPoseRef.current = null;
        setLockedPoseStatus('');
        setLockedPoseInfo(null);
        await loadSigns();
        setTimeout(() => {
          setSaveStatus('');
          setPoseCaptureNotice('');
        }, 5000);
      } else {
        setSaveStatus('❌ सेव करने में समस्या: ' + (data.error || 'अज्ञात त्रुटि'));
      }
    } catch (e: any) {
      setSaveStatus('❌ सेव करने में त्रुटि आई: ' + e.message);
    } finally {
      setIsRecordingSign(false);
    }
  };

  // 10. Capture Live Camera Pose for an Existing Custom Sign
  const handleCaptureLivePose = async (signId: string, signName: string) => {
    if (!cameraActive) {
      setPoseCaptureNotice('⚠️ कृपया पहले "कैमरा स्टार्ट करें" बटन दबाएं ताकि आपका हाथ दिख सके!');
      setTimeout(() => setPoseCaptureNotice(''), 4000);
      return;
    }

    let rawLm = latestRawLandmarksRef.current;
    let fingerSig = latestFingerSignatureRef.current;
    if ((!rawLm || rawLm.length < 21) && lastStableLandmarksRef.current && (Date.now() - lastStableTimeRef.current < 8000)) {
      rawLm = lastStableLandmarksRef.current;
      fingerSig = lastStableSignatureRef.current;
    }

    if (!rawLm || rawLm.length < 21) {
      setPoseCaptureNotice('⚠️ कैमरे के सामने अपना हाथ लाएं ताकि AI पोज़ को कैप्चर कर सके!');
      setTimeout(() => setPoseCaptureNotice(''), 4000);
      return;
    }

    const wrist = rawLm[0];
    const palmSize = Math.max(Math.hypot(wrist.x - rawLm[9].x, wrist.y - rawLm[9].y), 0.05);
    const normalized = rawLm.map((p: any) => [
      (p.x - wrist.x) / palmSize,
      (p.y - wrist.y) / palmSize,
      (p.z - wrist.z) / palmSize
    ]);

    try {
      const res = await fetch('/api/signs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: signId,
          landmarksSample: normalized,
          fingerSignature: fingerSig || latestFingerSignatureRef.current || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setPoseCaptureNotice(`🎉 "${signName}" का लाइव हाथ पोज़ कैप्चर हो गया! अब कैमरा इसे तुरंत पहचान लेगा।`);
        speakHindi(`${signName} का पोज़ रिकॉर्ड हो गया!`);
        loadSigns();
        setTimeout(() => setPoseCaptureNotice(''), 5000);
      }
    } catch (e) {
      setPoseCaptureNotice('❌ पोज़ सेव करने में त्रुटि आई।');
      setTimeout(() => setPoseCaptureNotice(''), 4000);
    }
  };

  // 11. Instant 1-Click Learn for Live Hackathon Demo
  const handleInstantLearn = async () => {
    const name = quickSignName.trim();
    if (!name) {
      alert('कृपया नए साइन का नाम लिखें (जैसे: कैंटीन, कैरम)!');
      return;
    }
    if (!cameraActive) {
      alert('कृपया पहले "कैमरा ऑन करें" बटन दबाएं ताकि हाथ की उंगलियां दिख सकें!');
      return;
    }

    let rawLm = latestRawLandmarksRef.current;
    let fingerSig = latestFingerSignatureRef.current;
    if ((!rawLm || rawLm.length < 21) && lastStableLandmarksRef.current && (Date.now() - lastStableTimeRef.current < 8000)) {
      rawLm = lastStableLandmarksRef.current;
      fingerSig = lastStableSignatureRef.current;
    }

    if (!rawLm || rawLm.length < 21) {
      alert('कृपया कैमरे के सामने अपना हाथ लाएं और वह नया इशारा बनाएं जो सिखाना चाहते हैं!');
      return;
    }

    setIsRecordingSign(true);
    const wrist = rawLm[0];
    const palmSize = Math.max(Math.hypot(wrist.x - rawLm[9].x, wrist.y - rawLm[9].y), 0.05);
    const landmarksToSave = rawLm.map((p: any) => [
      (p.x - wrist.x) / palmSize,
      (p.y - wrist.y) / palmSize,
      (p.z - wrist.z) / palmSize
    ]);

    try {
      const res = await fetch('/api/signs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameHindi: name,
          nameEnglish: name,
          category: 'college',
          landmarksSample: landmarksToSave,
          fingerSignature: fingerSig || latestFingerSignatureRef.current || null,
          recordedBy: 'Hackathon Live Demo'
        })
      });
      const data = await res.json();
      if (data.success) {
        setPoseCaptureNotice(`🎉 बधाई! "${name}" साइन तुरंत सीख लिया गया! अब कैमरे के सामने यह इशारा करें।`);
        speakHindi(`${name} सीख लिया गया है!`);
        setQuickSignName('');
        loadSigns();
        setTimeout(() => setPoseCaptureNotice(''), 6000);
      }
    } catch (e) {
      alert('साइन सेव करने में समस्या आई।');
    } finally {
      setIsRecordingSign(false);
    }
  };

  // 12. Delete a Custom Sign
  const handleDeleteSign = async (id: string, name: string) => {
    if (!confirm(`क्या आप "${name}" साइन को हटाना चाहते हैं?`)) return;
    try {
      const res = await fetch(`/api/signs?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPoseCaptureNotice(`🗑️ "${name}" साइन हटा दिया गया।`);
        setTimeout(() => setPoseCaptureNotice(''), 3000);
        loadSigns();
      }
    } catch (e) {
      alert('साइन हटाने में त्रुटि आई।');
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      {/* Top Banner with Audio Unlock Notice for Mobile */}
      <div style={{
        background: audioUnlocked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.15)',
        border: `1px solid ${audioUnlocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.4)'}`,
        borderRadius: '14px',
        padding: '12px 18px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Smartphone size={22} style={{ color: '#10b981' }} />
          <div>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
              {aiStatus}
            </span>
            <p style={{ color: '#94a3b8', fontSize: '12px' }}>
              {handsDetectedCount > 0 ? `🟢 ${handsDetectedCount} हाथ डिटेक्ट हो रहा है!` : 'हाथ कैमरा के सामने लाएं'}
            </p>
          </div>
        </div>

        {!audioUnlocked && (
          <button
            onClick={unlockAudio}
            className="btn-emerald"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <Volume2 size={16} /> 🔊 आवाज़ चालू करें (Tap to Unmute)
          </button>
        )}
      </div>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)', padding: '8px 12px', borderRadius: '12px', color: 'white', fontWeight: 800, fontSize: '18px' }}>
            BS
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>
              बोली-साइन <span style={{ color: '#3b82f6', fontSize: '18px' }}>BoliSign</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Indian Sign Language to Hindi Speech • Live AI Hand Tracker
            </p>
          </div>
        </div>

        <button 
          onClick={() => {
            setVoiceEnabled(!voiceEnabled);
            if (!voiceEnabled) speakHindi('आवाज़ चालू है');
          }}
          style={{ 
            background: voiceEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: voiceEnabled ? '#10b981' : '#ef4444',
            border: `1px solid ${voiceEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: '8px 14px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {voiceEnabled ? 'आवाज़ ऑन' : 'म्यूट'}
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('interpret')}
          style={{
            background: activeTab === 'interpret' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'interpret' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Camera size={16} />
          1. लाइव कैमरा इंटरप्रेटर
        </button>

        <button
          onClick={() => setActiveTab('train')}
          style={{
            background: activeTab === 'train' ? 'var(--emerald)' : 'transparent',
            color: activeTab === 'train' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <UserCheck size={16} />
          2. कॉलेज एम्प्लॉई ट्रेनिंग
        </button>

        <button
          onClick={() => setActiveTab('reverse')}
          style={{
            background: activeTab === 'reverse' ? '#8b5cf6' : 'transparent',
            color: activeTab === 'reverse' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Mic size={16} />
          3. रिवर्स मोड (Two-Way)
        </button>
      </nav>

      {/* SHARED VIEW: TAB 1 (INTERPRETER) & TAB 2 (COLLEGE EMPLOYEE TRAINING) */}
      <div style={{ display: activeTab === 'reverse' ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Left Column: Live Vision Screen (3D Hand Skeleton, Camera / Video Controls, Instant Audio Test Bar) */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={18} style={{ color: '#10b981' }} />
                लाइव विज़न स्क्रीन (3D Hand Skeleton)
              </h3>
              <span style={{ fontSize: '12px', color: '#10b981' }}>{fingerStates}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!cameraActive ? (
                <>
                  <button onClick={startCamera} className="btn-emerald" style={{ padding: '8px 14px', fontSize: '13px' }}>
                    📷 कैमरा ऑन करें
                  </button>
                  <button 
                    onClick={() => playDemoVideo('/demo1.mp4', 'demo1.mp4')} 
                    className="btn-purple" 
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    🎬 demo1.mp4
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="btn-glass" 
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    title="अपनी कोई अन्य वीडियो फ़ाइल टेस्ट करें"
                  >
                    📁 अन्य वीडियो
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="video/*" 
                    style={{ display: 'none' }} 
                  />
                </>
              ) : (
                <button onClick={stopCamera} className="btn-danger" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  {isVideoFileMode ? '⏹️ वीडियो बंद करें' : '⏹️ कैमरा बंद करें'}
                </button>
              )}
            </div>
          </div>

          {/* Viewfinder */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '360px', 
            borderRadius: '14px', 
            overflow: 'hidden', 
            background: '#040711',
            border: '2px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Hidden video stream source */}
            <video 
              ref={videoRef} 
              playsInline 
              muted 
              autoPlay
              style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }} 
            />
            
            {/* Active display canvas */}
            <canvas 
              ref={canvasRef} 
              width={640} 
              height={480} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />

            {isVideoFileMode && cameraActive && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(99, 102, 241, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                वीडियो टेस्ट मोड: {currentVideoName}
              </div>
            )}

            {!cameraActive && (
              <div style={{ position: 'absolute', textAlign: 'center', padding: '20px', maxWidth: '480px' }}>
                {cameraErrorNotice ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '14px',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <h4 style={{ color: '#f87171', fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>
                          कैमरा समस्या का समाधान:
                        </h4>
                        <p style={{ color: '#fca5a5', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                          {cameraErrorNotice}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera size={44} style={{ color: '#475569', marginBottom: '8px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '14px' }}>
                      हाथ के इशारे पहचानने और नया साइन सिखाने के लिए कैमरा ऑन करें:
                    </p>
                  </>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={startCamera} className="btn-emerald" style={{ padding: '10px 18px' }}>
                    {cameraErrorNotice ? '🔄 दोबारा कोशिश करें' : '📷 कैमरा स्टार्ट करें'}
                  </button>
                  <button 
                    onClick={() => playDemoVideo('/demo1.mp4', 'demo1.mp4')} 
                    className="btn-purple" 
                    style={{ padding: '10px 18px' }}
                  >
                    🎬 demo1.mp4 टेस्ट करें
                  </button>
                </div>
              </div>
            )}

            {/* Detected Badge */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              right: '10px',
              background: 'rgba(10, 14, 23, 0.88)',
              backdropFilter: 'blur(8px)',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>पहचाना गया इशारा</span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', margin: 0 }}>
                  {currentSign}
                </h3>
              </div>

              {isSpeaking && (
                <div style={{ display: 'flex', gap: '3px' }}>
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Test Bar with Base + Custom Employee Signs */}
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 700 }}>
                👇 तुरंत आवाज़ टेस्ट करने के लिए क्लिक करें:
              </span>
              {customSigns.length > 0 && (
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  ✨ {customSigns.length} नया साइन एक्टिव
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { name: 'नमस्ते', icon: '✋' },
                { name: 'पानी', icon: '🤏' },
                { name: 'मदद चाहिए (SOS)', icon: '🤙' },
                { name: 'लाइब्रेरी (कॉलेज)', icon: '✌️' },
                { name: 'अटेंडेंस', icon: '☝️' },
                { name: 'हाँ', icon: '👍' },
                { name: 'नहीं', icon: '👎' },
                { name: 'खाना', icon: '🤌' },
                { name: 'डॉक्टर', icon: '🩺' },
                { name: 'धन्यवाद', icon: '🙏' }
              ].map(item => (
                <button
                  key={item.name}
                  onClick={() => handleQuickTest(item.name)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {item.icon} {item.name}
                </button>
              ))}

              {/* Custom Employee Trained Signs */}
              {customSigns.map(cs => (
                <button
                  key={cs.id}
                  onClick={() => handleQuickTest(cs.nameHindi)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(16, 185, 129, 0.25))',
                    border: '1px solid #3b82f6',
                    color: '#67e8f9',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✨ {cs.nameHindi}
                </button>
              ))}
            </div>
          </div>

          {/* Notice banner for live pose capture */}
          {poseCaptureNotice && (
            <div style={{
              marginTop: '12px',
              background: poseCaptureNotice.includes('⚠️') ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${poseCaptureNotice.includes('⚠️') ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {poseCaptureNotice}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (TAB 1: LIVE INTERPRETER MODE) */}
        {activeTab === 'interpret' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sentence Builder */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} style={{ color: '#3b82f6' }} />
                  साइन सीक्वेंस & AI वाक्य निर्माण
                </h3>
                {sentenceTokens.length > 0 && (
                  <button 
                    onClick={() => { setSentenceTokens([]); setFluentHindiSentence(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    साफ़ करें (Clear)
                  </button>
                )}
              </div>

              <div style={{ 
                minHeight: '65px', 
                background: 'rgba(0, 0, 0, 0.3)', 
                borderRadius: '10px', 
                padding: '10px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                {sentenceTokens.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    जैसे ही आप इशारे करेंगे, वे यहाँ जुड़ते जाएंगे...
                  </span>
                ) : (
                  sentenceTokens.map((t, idx) => (
                    <span 
                      key={idx}
                      style={{ 
                        background: 'rgba(59, 130, 246, 0.25)', 
                        color: '#93c5fd', 
                        padding: '4px 10px', 
                        borderRadius: '16px', 
                        fontSize: '13px',
                        fontWeight: 700,
                        border: '1px solid rgba(59, 130, 246, 0.4)'
                      }}
                    >
                      {t}
                    </span>
                  ))
                )}
              </div>

              <button
                onClick={handleGenerateSentence}
                disabled={sentenceTokens.length === 0}
                className="btn-emerald"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                <Sparkles size={16} />
                AI से प्राकृतिक हिंदी वाक्य बनाएं और बोलें
              </button>
            </div>

            {/* Hindi Spoken Output */}
            <div className="glass-panel" style={{ padding: '20px', flex: 1, borderColor: fluentHindiSentence ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  🔊 बोली गई प्राकृतिक हिंदी
                </span>
                {fluentHindiSentence && (
                  <button
                    onClick={() => speakHindi(fluentHindiSentence)}
                    style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                  >
                    <Volume2 size={14} /> दोबारा बोलें
                  </button>
                )}
              </div>

              <div style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                color: fluentHindiSentence ? '#f8fafc' : 'var(--text-muted)', 
                lineHeight: 1.4,
                minHeight: '60px'
              }}>
                {fluentHindiSentence || 'वाक्य यहाँ साफ़ हिंदी में दिखाई देगा और स्पीकर से बोलेगा...'}
              </div>
            </div>

            {/* Instant Hackathon 1-Click Fast Trainer Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                    ⚡ 1-क्लिक में तुरंत नया साइन सिखाएं
                  </span>
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                  color: cameraActive && handsDetectedCount > 0 ? '#4ade80' : '#f87171',
                  fontWeight: 700
                }}>
                  {cameraActive ? (handsDetectedCount > 0 ? '✋ हाथ लाइव' : '⚠️ हाथ दिखाएं') : '📷 कैमरा बंद'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="नया साइन नाम (जैसे: कैंटीन, फीस...)"
                  value={quickSignName}
                  onChange={e => setQuickSignName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInstantLearn(); }}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '13px'
                  }}
                />
                <button
                  onClick={handleInstantLearn}
                  disabled={isRecordingSign}
                  className="btn-emerald"
                  style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 700 }}
                >
                  🎯 {isRecordingSign ? 'सेव हो रहा...' : 'सिखाएं'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN (TAB 2: COLLEGE EMPLOYEE TRAINING STUDIO) */}
        {activeTab === 'train' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Training Studio Form */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={20} style={{ color: '#10b981' }} />
                    कॉलेज एम्प्लॉई ट्रेनिंग स्टूडियो
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0 0' }}>
                    कॉलेज के नए स्थान या सेवा के लिए लाइव हाथ इशारा AI को सिखाएं
                  </p>
                </div>

                <span style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  fontWeight: 700,
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}>
                  🎓 कर्मचारी पोर्टल
                </span>
              </div>

              {/* Live Hand Pose Sensor Monitor */}
              <div style={{
                background: cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cameraActive && handsDetectedCount > 0 ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 लाइव कैमरा सेंसर स्थिति:
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                    color: cameraActive && handsDetectedCount > 0 ? '#4ade80' : '#f87171'
                  }}>
                    {cameraActive ? (handsDetectedCount > 0 ? `🟢 हाथ डिटेक्टेड (${handsDetectedCount})` : '⚠️ हाथ नहीं दिख रहा') : '📷 कैमरा बंद'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                  {cameraActive 
                    ? (handsDetectedCount > 0 
                        ? `✅ लाइव उंगलियों का पैटर्न: ${fingerStates} (इशारा बनाकर रखें और नीचे सेव दबाएं)` 
                        : '⚠️ कैमरे के सामने अपना हाथ लाएं और वह इशारा बनाकर रखें जो आप सिखाना चाहते हैं।')
                    : '⚠️ कैमरा बंद है! नीचे "कैमरा ऑन करें" बटन दबाएं ताकि AI आपके हाथ की उंगलियां देख सके।'}
                </p>
                {!cameraActive && (
                  <button 
                    onClick={startCamera} 
                    className="btn-emerald" 
                    style={{ marginTop: '10px', padding: '6px 14px', fontSize: '12px' }}
                  >
                    📷 अभी कैमरा ऑन करें
                  </button>
                )}
              </div>

              {/* Step-by-Step Training Guide Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                    यह कैसे काम करता है? (सरल 3 स्टेप्स):
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '12px' }}>१. कैमरा ऑन करें</div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>ऊपर कैमरा चालू करें ताकि हाथ पर हरा स्केलेटन दिखे।</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '12px' }}>२. नया इशारा बनाएं</div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>कैमरे के सामने नया पोज़ बनाकर रखें (उदा. 3 उंगलियां)।</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#34d399', fontWeight: 800, fontSize: '12px' }}>३. नाम लिख सेव करें</div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>नाम (उदा. "कैंटीन") लिखकर सेव बटन दबाएं!</div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  💡 <strong>तुरंत टेस्ट कैसे करें:</strong> सेव होने के बाद जैसे ही आप वही 3 उंगलियों वाला इशारा कैमरे के आगे करेंगे, AI तुरंत स्क्रीन पर <strong>"✓ कैंटीन"</strong> दिखाएगा और आवाज़ में बोलेगा!
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  साइन का हिंदी नाम*:
                </label>
                <input
                  type="text"
                  placeholder="जैसे: फीस काउंटर, कंप्यूटर लैब, खेल मैदान, सेमिनार हॉल..."
                  value={newSignHindi}
                  onChange={e => setNewSignHindi(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '15px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  साइन का अंग्रेजी नाम (वैकल्पिक):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fees Counter, Computer Lab..."
                  value={newSignEnglish}
                  onChange={e => setNewSignEnglish(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  कैटेगरी:
                </label>
                <select
                  value={newSignCategory}
                  onChange={(e: any) => setNewSignCategory(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  <option value="college">कॉलेज संबंध (College Specific)</option>
                  <option value="daily">दैनिक बातचीत (Daily Use)</option>
                  <option value="emergency">आपातकालीन (Emergency)</option>
                </select>
              </div>

              {/* Live Pose Locking Studio */}
              <div style={{
                marginBottom: '16px',
                background: lockedPoseInfo ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.1)',
                border: `1px solid ${lockedPoseInfo ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                    ✋ हाथ पोज़ कैप्चर & लॉक
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                    {liveGestureName ? `वर्तमान: ${liveGestureName}` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleLockCurrentPose}
                    className="btn-purple"
                    style={{
                      flex: 1,
                      minWidth: '180px',
                      justifyContent: 'center',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      background: lockedPoseInfo ? 'rgba(16, 185, 129, 0.25)' : undefined
                    }}
                  >
                    {lockedPoseInfo ? `🔒 पोज़ लॉक है (${lockedPoseInfo.label})` : '🔒 अभी यह पोज़ लॉक करें'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCapturePoseCountdown}
                    className="btn-glass"
                    style={{
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                    title="3 सेकंड का समय देकर पोज़ कैप्चर करें"
                  >
                    ⏱️ {countdownSeconds !== null ? `${countdownSeconds}...` : '३s टाइमर'}
                  </button>

                  {lockedPoseInfo && (
                    <button
                      type="button"
                      onClick={handleUnlockPose}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#fca5a5',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      🔄 अनलॉक
                    </button>
                  )}
                </div>

                {lockedPoseInfo && (
                  <div style={{
                    fontSize: '12px',
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    textAlign: 'center',
                    fontWeight: 700
                  }}>
                    ✅ पोज़ लॉक: <strong>{lockedPoseInfo.label}</strong> (अब आप आराम से नाम लिखकर नीचे 'सेव' दबाएं)
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveSign}
                disabled={isRecordingSign}
                className="btn-emerald"
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 700
                }}
              >
                <PlusCircle size={18} />
                {isRecordingSign ? 'सेव हो रहा है...' : '🎯 नया साइन और लाइव हाथ पोज़ सेव करें'}
              </button>

              {saveStatus && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: saveStatus.includes('❌') || saveStatus.includes('⚠️') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${saveStatus.includes('❌') || saveStatus.includes('⚠️') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  textAlign: 'center', 
                  fontWeight: 600, 
                  color: saveStatus.includes('❌') || saveStatus.includes('⚠️') ? '#f87171' : '#34d399', 
                  fontSize: '13px' 
                }}>
                  {saveStatus}
                </div>
              )}
            </div>

            {/* List of Trained Signs */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                  सिखाए गए साइन (कुल: {allSigns.length})
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {customSigns.length} कॉलेज एम्प्लॉई साइन
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {[
                  ...allSigns.filter(s => !BASE_SIGN_IDS.includes(s.id)).reverse(),
                  ...allSigns.filter(s => BASE_SIGN_IDS.includes(s.id))
                ].map(s => {
                  const isCustom = !BASE_SIGN_IDS.includes(s.id);
                  const hasPose = Boolean((s.landmarksSample && s.landmarksSample.length === 21) || s.fingerSignature);
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: isCustom ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isCustom ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: isCustom ? '#a5b4fc' : '#ffffff' }}>
                            {s.nameHindi}
                          </h4>
                          {isCustom && (
                            <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.3)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                              कस्टम
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {s.category.toUpperCase()} {s.recordedBy ? `• ${s.recordedBy}` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '3px 10px',
                          borderRadius: '10px',
                          background: isCustom ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.2)',
                          color: isCustom ? '#34d399' : '#93c5fd',
                          fontWeight: 700,
                          border: `1px solid ${isCustom ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`
                        }}>
                          {isCustom ? (hasPose ? '✓ 3D पोज़ एक्टिव' : '⚠️ पोज़ सेट करें') : '✓ डिफ़ॉल्ट AI साइन'}
                        </span>

                        <button
                          onClick={() => handleCaptureLivePose(s.id, s.nameHindi)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#c7d2fe',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                          title="कैमरे से इस साइन के लिए हाथ का लाइव पोज़ रिकॉर्ड/अपडेट करें"
                        >
                          📷 पोज़ अपडेट
                        </button>

                        <button
                          onClick={() => speakHindi(s.nameHindi)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🔊 सुनें
                        </button>

                        {isCustom && (
                          <button
                            onClick={() => handleDeleteSign(s.id, s.nameHindi)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="साइन हटाएं"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TAB 3: REVERSE MODE (Two-Way Voice to Text Hub) */}
      <div style={{ display: activeTab === 'reverse' ? 'block' : 'none', maxWidth: '780px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '28px', textAlign: 'center' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '10px', borderRadius: '50%', color: '#a78bfa' }}>
              <Mic size={24} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
              रिवर्स मोड: टू-वे संवाद (Voice-to-Text)
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px', maxWidth: '560px', margin: '0 auto 24px auto' }}>
            सामान्य व्यक्ति माइक दबाकर हिंदी में बोलेगा, और AI तुरंत उसे बड़े अक्षरों में मूक-बधिर साथी के पढ़ने के लिए स्क्रीन पर दिखाएगा।
          </p>

          {/* Central Pulsing Microphone Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <button
              onClick={toggleListening}
              className={isListening ? 'mic-listening' : ''}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: isListening 
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                border: isListening ? '3px solid #fecaca' : '3px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isListening 
                  ? '0 0 30px rgba(239, 68, 68, 0.8)' 
                  : '0 8px 25px rgba(139, 92, 246, 0.5)',
                transition: 'all 0.3s ease'
              }}
              title={isListening ? 'माइक बंद करने के लिए क्लिक करें' : 'माइक चालू करने के लिए क्लिक करें'}
            >
              {isListening ? <MicOff size={42} /> : <Mic size={42} />}
            </button>

            <div style={{ marginTop: '14px' }}>
              <span style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isListening ? '#f87171' : '#c4b5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center'
              }}>
                {isListening ? (
                  <>
                    <span className="recording-dot" />
                    सुन रहे हैं... हिंदी में बोलिए (Tap to Stop)
                  </>
                ) : (
                  '🎙️ माइक दबाकर हिंदी में बोलें (Tap to Speak)'
                )}
              </span>

              {isListening && (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                </div>
              )}
            </div>

            {/* Speech Notice Banner */}
            {speechNotice && (
              <div style={{
                marginTop: '12px',
                padding: '8px 16px',
                borderRadius: '20px',
                background: speechNotice.includes('⚠️') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                border: `1px solid ${speechNotice.includes('⚠️') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                color: speechNotice.includes('⚠️') ? '#fca5a5' : '#e9d5ff',
                fontSize: '12px',
                fontWeight: 600,
                maxWidth: '520px'
              }}>
                {speechNotice}
              </div>
            )}
          </div>

          {/* Big High-Contrast Visual Box for Deaf User */}
          <div style={{
            background: '#020617',
            borderRadius: '18px',
            padding: '24px 20px',
            border: '2px solid rgba(139, 92, 246, 0.45)',
            boxShadow: 'inset 0 2px 20px rgba(0, 0, 0, 0.8), 0 8px 30px rgba(139, 92, 246, 0.15)',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👁️ मूक-बधिर साथी के लिए देवनागरी डिस्प्ले (High-Contrast)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {spokenHindiText && (
                  <>
                    <button
                      onClick={() => speakHindi(spokenHindiText)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}
                    >
                      <Volume2 size={12} /> आवाज़ सुनें
                    </button>
                    <button
                      onClick={copyToClipboard}
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#93c5fd',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}
                    >
                      {copiedNotice ? <Check size={12} /> : <Copy size={12} />}
                      {copiedNotice ? 'कॉपी हुआ!' : 'कॉपी करें'}
                    </button>
                    <button
                      onClick={() => { setSpokenHindiText(''); setSpeechNotice(''); }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="टेक्स्ट साफ़ करें"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <p style={{
              fontSize: '26px',
              fontWeight: 800,
              color: spokenHindiText ? '#facc15' : '#475569',
              lineHeight: 1.45,
              minHeight: '80px',
              margin: 0
            }}>
              {spokenHindiText || 'माइक दबाकर बोलें या नीचे से वाक्य चुनें...'}
            </p>
          </div>

          {/* College Quick Phrases */}
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#c4b5fd', marginBottom: '10px' }}>
              🏛️ तुरंत भेजने के लिए कॉलेज के सामान्य वाक्य:
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                'हाँ, लाइब्रेरी दूसरे माले पर खुली है।',
                'प्रिंसिपल सर अपने केबिन में मौजूद हैं।',
                'आपकी आज की अटेंडेंस लग चुकी है।',
                'फीस काउंटर खिड़की नंबर 3 पर है।',
                'कंप्यूटर लैब में क्लास चल रही है।',
                'कृपया 5 मिनट प्रतीक्षा करें।',
                'धन्यवाद! आपका दिन शुभ हो।'
              ].map(phrase => (
                <button
                  key={phrase}
                  onClick={() => {
                    setSpokenHindiText(phrase);
                    speakHindi(phrase);
                    setSpeechNotice(`चुना गया: "${phrase}"`);
                  }}
                  style={{
                    background: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    color: '#e9d5ff',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  "{phrase}"
                </button>
              ))}
            </div>
          </div>

          {/* Manual Hindi Input fallback */}
          <div style={{
            display: 'flex',
            gap: '8px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <input
              type="text"
              placeholder="या यहाँ कीबोर्ड से हिंदी में टाइप करें..."
              value={manualHindiInput}
              onChange={e => setManualHindiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && manualHindiInput.trim()) {
                  setSpokenHindiText(manualHindiInput.trim());
                  speakHindi(manualHindiInput.trim());
                  setManualHindiInput('');
                }
              }}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'white',
                fontSize: '14px'
              }}
            />
            <button
              onClick={() => {
                if (manualHindiInput.trim()) {
                  setSpokenHindiText(manualHindiInput.trim());
                  speakHindi(manualHindiInput.trim());
                  setManualHindiInput('');
                }
              }}
              className="btn-purple"
              style={{ padding: '10px 18px', fontSize: '13px' }}
            >
              दिखाएं & बोलें
            </button>
          </div>

        </div>
      </div>
      </div>
  );
}
