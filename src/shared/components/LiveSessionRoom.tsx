import React, { useState, useEffect, useRef } from 'react';
import { InterpretationSession, User } from '../types';
import { api } from '../api';
import callRoomBg from '../../assets/images/call_room_background_1793959968131.jpg';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  ConnectionState,
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Signal,
  Wifi,
  Shield,
  Clock,
  Volume2,
  BookOpen,
  Radio,
  User as UserIcon,
  Settings,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface LiveSessionRoomProps {
  session: InterpretationSession;
  currentUser: User;
  onEndSession: (sessionId: string) => Promise<void>;
  onClose: () => void;
  onOpenCompletionModal: (sessionId: string) => void;
}

export const LiveSessionRoom: React.FC<LiveSessionRoomProps> = ({
  session,
  currentUser,
  onEndSession,
  onClose,
  onOpenCompletionModal,
}) => {
  const isVideoMode = session.communicationMode === 'video';

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoMode);
  const [isLowBandwidth, setIsLowBandwidth] = useState(session.lowBandwidthMode);
  const [duration, setDuration] = useState(session.durationSeconds || 0);
  const [showTerminology, setShowTerminology] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [endingCall, setEndingCall] = useState(false);

  // LiveKit Connection States
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [cloudUrl, setCloudUrl] = useState<string>('wss://orozo-translation-8nvelq7r.livekit.cloud');
  const [apiKey, setApiKey] = useState<string>('API7DMjTx8g4u3b');
  const [hasSecret, setHasSecret] = useState<boolean>(true);
  const [secretInput, setSecretInput] = useState<string>('');
  const [secretSaving, setSecretSaving] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  // Web Audio mic activity level (0-100)
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Streams & Room Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Acquire Local Media (Camera & Microphone)
  useEffect(() => {
    let mounted = true;

    async function initLocalMedia() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: isVideoMode ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current && isVideoMode) {
          localVideoRef.current.srcObject = stream;
        }

        // Web Audio API Metering for Real Voice Waveforms
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);
            analyserRef.current = analyser;

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(buffer);
              let sum = 0;
              for (let i = 0; i < buffer.length; i++) {
                sum += buffer[i];
              }
              const average = sum / buffer.length;
              // Map 0-128 to 0-100
              setAudioLevel(Math.min(100, Math.round((average / 60) * 100)));
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch (audioErr) {
          console.warn('Audio metering fallback:', audioErr);
        }
      } catch (mediaErr: any) {
        console.warn('Local media access notice:', mediaErr.message || mediaErr);
        setConnectionNotice(
          'Camera or microphone permission not granted. Running in simulated fallback mode for testing.'
        );
      }
    }

    initLocalMedia();

    return () => {
      mounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isVideoMode]);

  // 2. Connect to LiveKit Cloud Room
  useEffect(() => {
    let active = true;

    async function initLiveKit() {
      try {
        setConnectionState('connecting');

        // Fetch credentials and token from backend
        const tokenRes = await api.getLiveKitToken(session.id);
        if (!active) return;

        setCloudUrl(tokenRes.url || 'wss://orozo-translation-8nvelq7r.livekit.cloud');
        setHasSecret(tokenRes.hasSecret);

        // Create LiveKit client Room
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        // Event Listeners
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (!active) return;
          if (state === ConnectionState.Connected) {
            setConnectionState('connected');
            setConnectionNotice(null);
          } else if (state === ConnectionState.Connecting) {
            setConnectionState('connecting');
          } else if (state === ConnectionState.Reconnecting) {
            setConnectionState('reconnecting');
          } else {
            setConnectionState('disconnected');
          }
        });

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (!active) return;
            setRemoteParticipantName(participant.name || participant.identity);

            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
              setHasRemoteVideo(true);
            } else if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
              setRemoteAudioLevel(65);
            }
          }
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
          if (track.kind === Track.Kind.Video) {
            setHasRemoteVideo(false);
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          setRemoteParticipantName(participant.name || participant.identity);
        });

        // Attempt WebSocket connection to LiveKit Cloud
        try {
          await room.connect(tokenRes.url, tokenRes.token);
          if (!active) return;

          setConnectionState('connected');

          // Publish local camera & mic
          if (isVideoMode && !isVideoOff) {
            await room.localParticipant.enableCameraAndMicrophone();
          } else {
            await room.localParticipant.setMicrophoneEnabled(true);
          }
        } catch (connectError: any) {
          console.warn('LiveKit cloud connection notice:', connectError?.message || connectError);
          // If the token was signed with placeholder because user hasn't provided the unmasked secret
          if (!tokenRes.hasSecret) {
            setConnectionState('local_media_active');
            setConnectionNotice(
              'Real device camera & audio active locally. LiveKit Cloud wss://orozo-translation-8nvelq7r.livekit.cloud is configured. Paste your API secret to enable multi-peer cloud relay.'
            );
          } else {
            setConnectionState('error');
            setConnectionNotice(connectError?.message || 'Failed to connect to LiveKit Cloud.');
          }
        }
      } catch (err: any) {
        if (!active) return;
        setConnectionState('local_media_active');
        console.warn('LiveKit initialization error:', err);
      }
    }

    initLiveKit();

    return () => {
      active = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [session.id, isVideoMode]);

  // Toggle Mute
  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    // Mute hardware stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    // Mute LiveKit room participant
    if (roomRef.current && roomRef.current.localParticipant) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted);
      } catch (e) {
        console.warn('LiveKit mute toggle:', e);
      }
    }
  };

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    try {
      if (!nextVideoOff) {
        // Turning camera ON
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (!videoTrack) {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          } else {
            localStreamRef.current = videoStream;
          }
        } else {
          videoTrack.enabled = true;
        }

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        if (roomRef.current && roomRef.current.localParticipant) {
          await roomRef.current.localParticipant.setCameraEnabled(true);
        }
      } else {
        // Turning camera OFF
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        if (roomRef.current && roomRef.current.localParticipant) {
          await roomRef.current.localParticipant.setCameraEnabled(false);
        }
      }
    } catch (e: any) {
      console.warn('Camera toggle error:', e);
      setIsVideoOff(true);
      setConnectionNotice(e?.message || 'Camera permission required for video call.');
    }
  };

  // Save API Secret at runtime
  const handleSaveSecret = async () => {
    if (!secretInput.trim()) return;
    setSecretSaving(true);
    try {
      const res = await api.updateLiveKitConfig({ apiSecret: secretInput.trim() });
      setHasSecret(res.hasSecret);
      setConnectionNotice('API Secret updated successfully! Reconnecting to LiveKit Cloud...');
      setShowConfigModal(false);

      // Reconnect room
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      const tokenRes = await api.getLiveKitToken(session.id);
      const newRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = newRoom;
      await newRoom.connect(tokenRes.url, tokenRes.token);
      setConnectionState('connected');
      setConnectionNotice(null);
    } catch (err: any) {
      alert(`Failed to save secret: ${err.message}`);
    } finally {
      setSecretSaving(false);
    }
  };

  // End Call
  const handleEndCall = async () => {
    setEndingCall(true);
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      await onEndSession(session.id);
      if (currentUser.role === 'interpreter') {
        onOpenCompletionModal(session.id);
      } else {
        onClose();
      }
    } catch (err: any) {
      alert(`Error ending call: ${err.message}`);
      setEndingCall(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Remote Audio Track (Hidden) */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Animated Photo Background Layer spanning the entire call section */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <img
          src={callRoomBg}
          alt="Clinical Telehealth Command Suite"
          className="w-full h-full object-cover animate-ken-burns origin-center filter brightness-[0.70] contrast-[1.08] saturate-[1.12]"
        />

        {/* Atmospheric Glass Vignette & Depth Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/90 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/15 via-transparent to-blue-950/50 animate-telemetry-glow" />

        {/* Ambient Telemetry Grid & Heartbeat Wave */}
        <svg
          className="absolute inset-0 w-full h-full opacity-15 pointer-events-none stroke-cyan-400"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="telehealth-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
              <circle cx="60" cy="0" r="1.5" fill="currentColor" fillOpacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#telehealth-grid)" />
          <path
            d="M0,180 L160,180 L180,150 L200,210 L220,180 L420,180 L440,130 L460,230 L480,180 L780,180 L800,160 L820,200 L840,180 L1400,180"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="animate-ecg opacity-40"
          />
        </svg>
      </div>

      {/* Top Header Bar (Transparent Frosted Glass) */}
      <div className="bg-slate-950/50 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div
            className={`h-3 w-3 rounded-full ${
              connectionState === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : connectionState === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-blue-400 animate-pulse'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 drop-shadow-xs">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Live Interpretation Session
              </span>
              <span className="text-xs bg-cyan-950/70 text-cyan-300 font-mono px-2 py-0.5 rounded-md border border-cyan-700/50 backdrop-blur-md">
                {session.id}
              </span>
              <span className="text-xs bg-white/10 text-slate-200 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-md">
                Ref: {session.requestReference}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {session.organizationName} • {session.serviceCategory.replace('_', ' ').toUpperCase()} •{' '}
              <strong className="text-cyan-300">
                {session.sourceLanguage.toUpperCase()} ⇄ {session.targetLanguage.toUpperCase()}
              </strong>
            </p>
          </div>
        </div>

        {/* Center / Right stats: Duration & LiveKit Status */}
        <div className="flex items-center space-x-3">
          {/* Duration Pill */}
          <div className="flex items-center space-x-1.5 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 font-mono text-sm">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-cyan-300">{formatTimer(duration)}</span>
          </div>

          {/* LiveKit Cloud Status Badge */}
          <button
            onClick={() => setShowConfigModal(true)}
            className={`hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
              connectionState === 'connected'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/60'
            }`}
            title="LiveKit Cloud Configuration"
          >
            <Signal className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {connectionState === 'connected' ? (
                <strong className="text-emerald-400">LiveKit Cloud Active</strong>
              ) : (
                <span>WebRTC Media Active</span>
              )}
            </span>
            <Settings className="w-3 h-3 ml-1 text-slate-400" />
          </button>

          {/* HIPAA / No Recording badge */}
          <div className="hidden md:flex items-center space-x-1.5 text-[11px] bg-red-950/60 backdrop-blur-md text-red-300 border border-red-500/30 px-2.5 py-1 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>Encrypted • No Recording</span>
          </div>

          {/* Glossary */}
          <button
            onClick={() => setShowTerminology(!showTerminology)}
            className="p-2 text-xs bg-white/10 hover:bg-white/20 text-slate-100 rounded-xl border border-white/15 flex items-center space-x-1 backdrop-blur-md cursor-pointer transition"
            title="Linguistic Glossary"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="hidden lg:inline">Glossary</span>
          </button>
        </div>
      </div>

      {/* Notice Banner (If API Secret needed for multi-peer LiveKit Cloud) */}
      {connectionNotice && (
        <div className="bg-blue-950/70 backdrop-blur-md border-b border-cyan-500/30 px-4 py-2 text-xs text-blue-200 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center space-x-2 truncate">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">{connectionNotice}</span>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer shadow-md transition"
          >
            Configure Secret
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 relative flex overflow-hidden z-10">
        {/* Call Viewport Grid */}
        <div className="flex-1 bg-transparent p-4 sm:p-6 flex flex-col justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 items-center max-w-5xl mx-auto w-full">
            {/* Box 1: Local Participant Feed (Requester / You) */}
            <div className="relative bg-slate-950/40 backdrop-blur-2xl border border-white/15 rounded-3xl h-72 sm:h-84 flex flex-col items-center justify-center overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-300">
              {(!isVideoOff) ? (
                <div className="relative w-full h-full bg-black/40 flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3.5 z-10">
                  <div className="relative w-24 h-24 rounded-3xl bg-cyan-950/60 text-cyan-300 flex items-center justify-center text-3xl font-black border border-cyan-700/50 shadow-inner backdrop-blur-md">
                    <UserIcon className="w-12 h-12" />
                    {/* Live audio activity ring */}
                    {!isMuted && audioLevel > 5 && (
                      <span
                        className="absolute inset-0 rounded-3xl border-2 border-emerald-400 animate-ping opacity-75"
                        style={{ animationDuration: '1.2s' }}
                      />
                    )}
                  </div>

                  {/* Real-time Dynamic Audio Waveform */}
                  <div className="flex items-center space-x-1 h-8">
                    {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                      const dynamicHeight = isMuted
                        ? 4
                        : Math.max(4, Math.round((audioLevel / 100) * 32 * ((bar % 3) + 0.6)));
                      return (
                        <span
                          key={bar}
                          className={`w-1.5 rounded-full transition-all duration-75 ${
                            isMuted ? 'bg-slate-600' : audioLevel > 15 ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`}
                          style={{ height: `${dynamicHeight}px` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    {isMuted ? (
                      <span className="text-red-400">Microphone Muted</span>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Voice Stream</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Local Participant Tag */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-white/10 z-10">
                <span className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span>
                  {currentUser.fullName} ({currentUser.role === 'interpreter' ? 'Interpreter' : 'Requester'})
                </span>
                {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400 ml-1" />}
              </div>
            </div>

            {/* Box 2: Remote Participant Feed (Interpreter or Client) */}
            <div className="relative bg-slate-950/40 backdrop-blur-2xl border border-white/15 rounded-3xl h-72 sm:h-84 flex flex-col items-center justify-center overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-300">
              {hasRemoteVideo ? (
                <div className="relative w-full h-full bg-black/40 flex items-center justify-center">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3.5 z-10">
                  <div className="w-24 h-24 rounded-3xl bg-blue-950/60 text-blue-300 flex items-center justify-center text-3xl font-black border border-blue-700/50 shadow-inner backdrop-blur-md">
                    <Volume2 className="w-12 h-12" />
                  </div>

                  {/* Remote Voice Indicator */}
                  <div className="flex items-center space-x-1 h-8">
                    {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                      <span
                        key={bar}
                        className="w-1.5 bg-cyan-400 rounded-full animate-bounce"
                        style={{
                          height: `${14 + (bar % 4) * 5}px`,
                          animationDelay: `${bar * 0.12}s`,
                          animationDuration: '1s',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Interpretation Channel Live</span>
                  </span>
                </div>
              )}

              {/* Remote Participant Tag */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-white/10 z-10">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>
                  {remoteParticipantName || session.interpreterName || 'Assigned Certified Interpreter'}
                </span>
              </div>
            </div>
          </div>

          {/* Speakerphone Banner for Assisted Calls */}
          {session.communicationMode === 'phone_assisted' && (
            <div className="max-w-xl mx-auto w-full my-3 p-3 bg-slate-950/50 backdrop-blur-xl border border-cyan-500/30 text-cyan-200 text-xs rounded-2xl flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Speakerphone Mode:</strong> Active on terminal speakerphone.
              </span>
            </div>
          )}

          {/* Bottom Control Bar (Transparent Frosted Dock) */}
          <div className="bg-slate-950/60 backdrop-blur-2xl border border-white/20 max-w-xl mx-auto w-full rounded-2xl p-3 flex items-center justify-between shadow-2xl ring-1 ring-white/10">
            {/* Microphone Toggle */}
            <button
              onClick={handleToggleMute}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle (Always clickable to enable or disable camera) */}
            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isVideoOff
                  ? 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10'
                  : 'bg-emerald-600/80 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>

            {/* Low-Bandwidth Mode */}
            <button
              onClick={() => setIsLowBandwidth(!isLowBandwidth)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                isLowBandwidth
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20 border border-white/10'
              }`}
              title="Toggle low-bandwidth optimization"
            >
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Low-Bandwidth</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              disabled={endingCall}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-1.5 border border-red-500/40"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{endingCall ? 'Ending...' : 'End Call'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Glossary */}
        {showTerminology && (
          <div className="w-80 bg-slate-950/85 backdrop-blur-2xl border-l border-white/15 p-4 overflow-y-auto flex flex-col justify-between z-20">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Linguistic Glossary
                  </h3>
                </div>
                <button
                  onClick={() => setShowTerminology(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Clinical Consent (የሕክምና ፈቃድ)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> የህክምና ስምምነት መስጠት
                    <br />
                    <strong>Oromo:</strong> Hayyama yaalaa kennuu
                    <br />
                    <strong>Tigrinya:</strong> ስምምዕ ሕክምና ምሃብ
                  </div>
                </div>

                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Sworn Testimony (የመሃላ ቃል)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> የመሐላ ቃል መስጠት
                    <br />
                    <strong>Oromo:</strong> Kakuudhaan ragaa kennuu
                    <br />
                    <strong>Somali:</strong> Markhaati dhaar ah
                  </div>
                </div>

                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Triage / Emergency (አስቸኳይ ሕክምና)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> ድንገተኛ የሕክምና እርዳታ
                    <br />
                    <strong>Oromo:</strong> Yaala ariifachiisaa
                    <br />
                    <strong>Tigrinya:</strong> ህጹጽ ረድኤት ሕክምና
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400">
              Verified clinical & legal terminology.
            </div>
          </div>
        )}
      </div>

      {/* LiveKit Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">LiveKit Cloud Configuration</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">LiveKit WebSocket URL</label>
                <div className="font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-blue-300 break-all select-all">
                  {cloudUrl}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">LiveKit API Key</label>
                <div className="font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-200 select-all">
                  {apiKey}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold">LiveKit API Secret</label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      hasSecret
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {hasSecret ? 'Configured' : 'Needs Unmasked Secret'}
                  </span>
                </div>
                <input
                  type="password"
                  placeholder="Paste unmasked API secret from LiveKit Cloud"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-white font-mono text-xs outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Note: The bulleted text (<code>••••••••••••••••</code>) was masked in your dashboard.
                  Copy the unmasked secret value from the LiveKit Cloud dashboard to authenticate the SFU relay.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleSaveSecret}
                disabled={secretSaving || !secretInput.trim()}
                className="px-4 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {secretSaving ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
