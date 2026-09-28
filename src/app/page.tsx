'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Volume2, VolumeX, Sparkles, Mic, PlusCircle, 
  BookOpen, UserCheck, Smartphone, CheckCircle, RefreshCw, AlertCircle
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

  // Reverse Mode
  const [spokenHindiText, setSpokenHindiText] = useState<string>('हाँ, लाइब्रेरी दूसरे माले पर खुली है।');
  const [manualHindiInput, setManualHindiInput] = useState<string>('');

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [poseCaptureNotice, setPoseCaptureNotice] = useState<string>('');

  const BASE_SIGN_IDS = ['sign-namaste', 'sign-paani', 'sign-madad', 'sign-haan', 'sign-nahi', 'sign-dhanyavaad', 'sign-doctor', 'sign-khana', 'sign-library', 'sign-attendance'];
  const customSigns = allSigns.filter(s => !BASE_SIGN_IDS.includes(s.id));

  // 1. Load signs from database
  const loadSigns = async () => {
    try {
      const res = await fetch('/api/signs');
      const data = await res.json();
      if (data.signs) setAllSigns(data.signs);
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

    // Rotation and distance-invariant finger extension:
    // A finger is OPEN if its tip is significantly farther from wrist and MCP than PIP
    const isIndexOpen = (dist(indexTip, wrist) > dist(indexPip, wrist) * 1.12 || indexTip.y < indexPip.y) && dist(indexTip, indexMcp) > palmSize * 0.58;
    const isMiddleOpen = (dist(middleTip, wrist) > dist(middlePip, wrist) * 1.12 || middleTip.y < middlePip.y) && dist(middleTip, middleMcp) > palmSize * 0.58;
    const isRingOpen = (dist(ringTip, wrist) > dist(ringPip, wrist) * 1.12 || ringTip.y < ringPip.y) && dist(ringTip, ringMcp) > palmSize * 0.58;
    const isPinkyOpen = (dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.12 || pinkyTip.y < pinkyPip.y) && dist(pinkyTip, pinkyMcp) > palmSize * 0.58;

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

    const stateDesc = `तर्जनी: ${isIndexOpen ? 'खुली' : 'मुड़ी'} | मध्यमा: ${isMiddleOpen ? 'खुली' : 'मुड़ी'} | अंगूठा: ${thumbPointsUp ? 'ऊपर' : thumbPointsDown ? 'नीचे' : isThumbOpen ? 'फैला' : 'बंद'}`;
    setFingerStates(stateDesc);

    // Save live finger signature snapshot for custom sign training
    latestFingerSignatureRef.current = {
      thumb: isThumbOpen,
      index: isIndexOpen,
      middle: isMiddleOpen,
      ring: isRingOpen,
      pinky: isPinkyOpen,
      thumbPointsUp,
      isPinch: isIndexThumbPinch
    };

    let detected = '';
    let conf = 0.95;

    // 0. Custom Hackathon / Employee Trained Signs (Checked FIRST for instant response)
    if (customSigns.length > 0) {
      for (const sign of customSigns) {
        // Method A: Deterministic Finger Topology Signature (100% invariant to scale and rotation)
        if (sign.fingerSignature) {
          const sig = sign.fingerSignature;
          const matchFingers = 
            sig.index === isIndexOpen &&
            sig.middle === isMiddleOpen &&
            sig.ring === isRingOpen &&
            sig.pinky === isPinkyOpen &&
            (sig.thumb === undefined || sig.thumb === isThumbOpen);

          if (matchFingers) {
            detected = sign.nameHindi;
            break;
          }
        }
        // Method B: Normalized 21-Landmark Distance Fallback
        else if (sign.landmarksSample && sign.landmarksSample.length === 21) {
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
          if (avgDiff < 0.38) {
            detected = sign.nameHindi;
            break;
          }
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

          speakHindi(detected);

          setSentenceTokens(prev => {
            if (!prev.includes(detected)) return [...prev, detected];
            return prev;
          });
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

  // 9. Save Custom Sign (with Live Camera Pose capture)
  const handleSaveSign = async () => {
    if (!newSignHindi.trim()) {
      alert('कृपया साइन का नाम लिखें!');
      return;
    }
    setIsRecordingSign(true);
    setSaveStatus('डेटाबेस में सेव हो रहा है...');

    // Extract live hand pose if camera is active
    let landmarksToSave: number[][] = [];
    if (latestRawLandmarksRef.current && latestRawLandmarksRef.current.length === 21) {
      const rawLm = latestRawLandmarksRef.current;
      const wrist = rawLm[0];
      const palmSize = Math.max(Math.hypot(wrist.x - rawLm[9].x, wrist.y - rawLm[9].y), 0.05);
      landmarksToSave = rawLm.map((p: any) => [
        (p.x - wrist.x) / palmSize,
        (p.y - wrist.y) / palmSize,
        (p.z - wrist.z) / palmSize
      ]);
    }

    try {
      const res = await fetch('/api/signs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameHindi: newSignHindi,
          nameEnglish: newSignEnglish || newSignHindi,
          category: newSignCategory,
          landmarksSample: landmarksToSave,
          fingerSignature: latestFingerSignatureRef.current || null,
          recordedBy: 'College Employee'
        })
      });
      const data = await res.json();
      if (data.success) {
        const hasLivePose = landmarksToSave.length === 21 || latestFingerSignatureRef.current;
        setSaveStatus(`✅ साइन "${newSignHindi}" ${hasLivePose ? 'लाइव AI फिंगर पोज़ के साथ' : ''} सेव हो गया!`);
        speakHindi(`${newSignHindi} सीख लिया गया है!`);
        setNewSignHindi('');
        setNewSignEnglish('');
        loadSigns();
      }
    } catch (e) {
      setSaveStatus('❌ सेव करने में त्रुटि आई।');
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

    if (!latestRawLandmarksRef.current || latestRawLandmarksRef.current.length < 21) {
      setPoseCaptureNotice('⚠️ कैमरे के सामने अपना हाथ लाएं ताकि AI पोज़ को कैप्चर कर सके!');
      setTimeout(() => setPoseCaptureNotice(''), 4000);
      return;
    }

    const rawLm = latestRawLandmarksRef.current;
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
          fingerSignature: latestFingerSignatureRef.current || null
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
      alert('कृपया नए साइन का नाम लिखें (जैसे: कैंटीन)!');
      return;
    }
    if (!cameraActive) {
      alert('कृपया पहले "कैमरा ऑन करें" बटन दबाएं ताकि हाथ की उंगलियां दिख सकें!');
      return;
    }
    if (!latestRawLandmarksRef.current || latestRawLandmarksRef.current.length < 21) {
      alert('कृपया कैमरे के सामने अपना हाथ लाएं और वह नया इशारा बनाएं जो सिखाना चाहते हैं!');
      return;
    }

    setIsRecordingSign(true);
    const rawLm = latestRawLandmarksRef.current;
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
          fingerSignature: latestFingerSignatureRef.current || null,
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

      {/* TAB 1: LIVE INTERPRETER (Always mounted so camera tracking is continuous across tabs) */}
      <div style={{ display: activeTab === 'interpret' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Left: Camera & Canvas */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>लाइव विज़न स्क्रीन (3D Hand Skeleton)</h3>
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
                      style={{ padding: '8px 14px', fontSize: '13px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                      🎬 demo1.mp4 टेस्ट करें
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
                        हाथ के इशारे पहचानने के लिए कैमरा ऑन करें या रिकॉर्डेड वीडियो टेस्ट करें:
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
                      style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                      🎬 demo1.mp4 टेस्ट करें
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="btn-glass" 
                      style={{ padding: '10px 14px' }}
                    >
                      📁 फ़ाइल चुनें
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

            {/* Instant Hackathon 1-Click Sign Trainer Card */}
            <div style={{
              marginTop: '14px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                    ⚡ हैकथॉन लाइव डेमो: 5 सेकंड में नया साइन सिखाएं
                  </span>
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                  color: cameraActive && handsDetectedCount > 0 ? '#4ade80' : '#f87171',
                  fontWeight: 700,
                  border: `1px solid ${cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.4)'}`
                }}>
                  {cameraActive ? (handsDetectedCount > 0 ? '✋ हाथ डिटेक्टेड (Live)' : '⚠️ कैमरे में हाथ दिखाएं') : '📷 पहले कैमरा चालू करें'}
                </span>
              </div>

              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                {cameraActive && handsDetectedCount > 0
                  ? `AI द्वारा पहचानी गई लाइव उंगलियां: ${fingerStates}`
                  : 'कैमरे के सामने कोई भी नया इशारा बनाएं (जैसे 3 उंगलियां), नीचे नाम लिखें और 1-क्लिक में सिखाएं!'}
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="नया साइन नाम लिखें (जैसे: कैंटीन, फीस, खेल मैदान...)"
                  value={quickSignName}
                  onChange={e => setQuickSignName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInstantLearn(); }}
                  style={{
                    flex: '1',
                    minWidth: '220px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#ffffff',
                    fontSize: '13px'
                  }}
                />
                <button
                  onClick={handleInstantLearn}
                  disabled={isRecordingSign}
                  className="btn-emerald"
                  style={{
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  🎯 {isRecordingSign ? 'सेव हो रहा है...' : 'तुरंत सिखाएं (1-Click Learn)'}
                </button>
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
                    ✨ {customSigns.length} नया साइन जोड़ा गया
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

            {/* Custom Employee Trained Signs Card on Main Screen */}
            {customSigns.length > 0 && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🎓</span>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#93c5fd', margin: 0 }}>
                        कॉलेज एम्प्लॉई द्वारा जोड़े गए विशेष साइन:
                      </h4>
                      <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                        ये साइन सीधे AI मॉडल और स्क्रीन पर एक्टिव हैं
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('train')}
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    + नया साइन जोड़ें
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                  {customSigns.map(cs => (
                      <div
                        key={cs.id}
                        style={{
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#4ade80', fontSize: '10px' }}>● एक्टिव</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>({cs.category})</span>
                          </div>
                          <h5 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: '2px 0 0 0' }}>
                            {cs.nameHindi}
                          </h5>
                          <span style={{ fontSize: '10px', color: cs.landmarksSample && cs.landmarksSample.length === 21 ? '#34d399' : '#f59e0b' }}>
                            {cs.landmarksSample && cs.landmarksSample.length === 21 ? '✓ पोज़ रिकॉर्डेड' : '⚠️ पोज़ रिकॉर्ड करें'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleQuickTest(cs.nameHindi)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#34d399',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            🔊 बोलें
                          </button>
                          <button
                            onClick={() => handleCaptureLivePose(cs.id, cs.nameHindi)}
                            style={{
                              background: 'rgba(99, 102, 241, 0.25)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#c7d2fe',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                            title="कैमरे से इस साइन के लिए लाइव हाथ पोज़ रिकॉर्ड करें"
                          >
                            📷 पोज़
                          </button>
                          <button
                            onClick={() => handleDeleteSign(cs.id, cs.nameHindi)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                            title="साइन हटाएं"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: AI Sentence Builder */}
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
          </div>
        </div>

      {/* TAB 2: TRAINING STUDIO */}
      <div style={{ display: activeTab === 'train' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>कॉलेज एम्प्लॉई ट्रेनिंग स्टूडियो</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
              कॉलेज के एम्प्लॉई से नया इशारा ऐप में जोड़ें
            </p>

            {/* Live AI Hand Tracker Monitor */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🤖 लाइव AI कैमरा सेंसर:
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: cameraActive && handsDetectedCount > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                  color: cameraActive && handsDetectedCount > 0 ? '#4ade80' : '#f87171'
                }}>
                  {cameraActive ? (handsDetectedCount > 0 ? '✋ हाथ डिटेक्टेड' : '⚠️ हाथ नहीं दिख रहा') : '📷 कैमरा बंद'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                {cameraActive 
                  ? (handsDetectedCount > 0 
                      ? `पहचाना गया पैटर्न: ${fingerStates} (यह लाइव पोज़ तुरंत सेव होगा)` 
                      : 'कैमरे के आगे हाथ लाएं ताकि AI आपकी उंगलियों की स्थिति पढ़ सके।')
                  : 'सुझाव: पहले टैब 1 ("लाइव कैमरा") में जाकर "कैमरा स्टार्ट करें" दबाएं, फिर यहाँ नया साइन जोड़ें!'}
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                साइन का हिंदी नाम*:
              </label>
              <input
                type="text"
                placeholder="जैसे: फीस काउंटर, कंप्यूटर लैब, खेल मैदान..."
                value={newSignHindi}
                onChange={e => setNewSignHindi(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: 'white',
                  fontSize: '15px'
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
                  border: '1px solid rgba(255, 255, 255, 0.1)',
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

            <button
              onClick={handleSaveSign}
              disabled={isRecordingSign}
              className="btn-emerald"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <PlusCircle size={18} />
              {isRecordingSign ? 'सेव हो रहा है...' : 'नया साइन डेटाबेस में सेव करें'}
            </button>

            {saveStatus && (
              <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 600, color: '#38bdf8', fontSize: '13px' }}>
                {saveStatus}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              सिखाए गए साइन (Total: {allSigns.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {allSigns.map(s => (
                <div
                  key={s.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{s.nameHindi}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {s.category.toUpperCase()} {s.recordedBy ? `• By ${s.recordedBy}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: s.landmarksSample && s.landmarksSample.length === 21 ? '#34d399' : '#f59e0b' }}>
                      {s.landmarksSample && s.landmarksSample.length === 21 ? '✓ पोज़ सेट' : '⚠️ पोज़ नहीं'}
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
                        fontSize: '12px'
                      }}
                      title="कैमरे से इस साइन के लिए हाथ का लाइव पोज़ रिकॉर्ड करें"
                    >
                      📷 पोज़
                    </button>
                    <button
                      onClick={() => speakHindi(s.nameHindi)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: 'none',
                        color: '#60a5fa',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🔊 सुनें
                    </button>
                    {!BASE_SIGN_IDS.includes(s.id) && (
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
                        🗑️ हटाएं
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* TAB 3: REVERSE MODE */}
      <div style={{ display: activeTab === 'reverse' ? 'block' : 'none', maxWidth: '700px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
              रिवर्स मोड: सामान्य व्यक्ति की बात मूक-बधिर साथी तक पहुँचाएं
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              सामान्य व्यक्ति जो भी हिंदी में बोलेगा या टाइप करेगा, वह यहाँ स्क्रीन पर बड़े देवनागरी अक्षरों में दिखेगा।
            </p>

            {/* Quick Replies */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px', justifyContent: 'center' }}>
              {[
                'हाँ, लाइब्रेरी खुली है।',
                'प्रिंसिपल सर ऑफिस में हैं।',
                'आपकी अटेंडेंस लग गई है।',
                'कैंटीन 10 मिनट में खुलेगी।'
              ].map(phrase => (
                <button
                  key={phrase}
                  onClick={() => {
                    setSpokenHindiText(phrase);
                    speakHindi(phrase);
                  }}
                  style={{
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#ddd6fe',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  "{phrase}"
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="यहाँ हिंदी में टाइप करें..."
                value={manualHindiInput}
                onChange={e => setManualHindiInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={() => {
                  if (manualHindiInput) {
                    setSpokenHindiText(manualHindiInput);
                    speakHindi(manualHindiInput);
                    setManualHindiInput('');
                  }
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                दिखाएं & बोलें
              </button>
            </div>

            {/* Big High-Contrast Box */}
            <div style={{
              background: '#030712',
              borderRadius: '16px',
              padding: '24px 16px',
              border: '2px solid rgba(139, 92, 246, 0.4)',
              minHeight: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <p style={{
                fontSize: '24px',
                fontWeight: 800,
                color: spokenHindiText ? '#facc15' : '#475569',
                lineHeight: 1.4
              }}>
                {spokenHindiText || 'बोली गई हिंदी यहाँ बड़े अक्षरों में दिखाई देगी...'}
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
