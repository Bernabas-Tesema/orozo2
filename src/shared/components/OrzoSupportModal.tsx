import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import {
  MessageSquare,
  Mic,
  Square,
  Play,
  Sparkles,
  Send,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Volume2,
  ShieldAlert,
  ArrowRight,
  Bot,
  User
} from 'lucide-react';

interface OrzoSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguageForRequest?: (languageCode: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'orzo';
  text: string;
  timestamp: string;
  audioResult?: any;
}

export const OrzoSupportModal: React.FC<OrzoSupportModalProps> = ({
  isOpen,
  onClose,
  onSelectLanguageForRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'audio_id'>('chat');
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'orzo',
      text: 'ሰላም! Welcome to ORZO Support. How can I assist you with language matching, dispatch workflows, or dialect identification today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  const [audioResult, setAudioResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, analyzingAudio]);

  if (!isOpen) return null;

  // Handle Text Chat
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await api.askOrzoSupport(textToSend, history);
      const orzoMsg: Message = {
        id: `orzo-${Date.now()}`,
        sender: 'orzo',
        text: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, orzoMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `orzo-err-${Date.now()}`,
        sender: 'orzo',
        text: `ORZO Support notice: ${err.message}. Please retry or contact dispatch coordinator.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setAudioResult(null);
      setRecordedAudioUrl(null);
      setRecordedAudioBase64(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRecordedAudioBase64(reader.result as string);
        };

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(`Microphone permission notice: ${err.message}. You can also pick a sample field recording below.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  // Analyze Audio
  const handleAnalyzeAudio = async (sampleId?: string, sampleName?: string) => {
    setAnalyzingAudio(true);
    setAudioResult(null);

    try {
      const res = await api.identifyAudioLanguage({
        audioBase64: recordedAudioBase64 || undefined,
        sampleId,
        clientNotes: sampleName || 'Recorded patient audio clip from triage desk',
      });

      setAudioResult(res.result);

      const userAudioQuery: Message = {
        id: `aud-req-${Date.now()}`,
        sender: 'user',
        text: sampleName ? `[Analyzed ${sampleName}]: "Which Ethiopian language is this?"` : `[Recorded Audio Clip (${recordingSeconds}s)]: "Which Ethiopian language is this?"`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const orzoAudioAnswer: Message = {
        id: `aud-res-${Date.now()}`,
        sender: 'orzo',
        text: `Identified Language: **${res.result.languageName} (${res.result.nativeName})**\nConfidence: ${res.result.confidencePercent}%\nDialect Variant: ${res.result.dialectVariant}\n\nTranscript Snippet:\n${res.result.transcriptSnippet}\n\nLinguistic Characteristics:\n${res.result.linguisticCharacteristics}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioResult: res.result,
      };

      setMessages((prev) => [...prev, userAudioQuery, orzoAudioAnswer]);
    } catch (err: any) {
      alert(`Language identification error: ${err.message}`);
    } finally {
      setAnalyzingAudio(false);
    }
  };

  const handlePreFillRequest = (langCode: string) => {
    if (onSelectLanguageForRequest) {
      onSelectLanguageForRequest(langCode);
      onClose();
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-lg">
        <span className="text-xs font-bold text-slate-800">ORZO Support</span>
        <button type="button" onClick={() => setMinimized(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer" title="Restore">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 overflow-hidden bg-black/40 flex ${maximized ? 'inset-0 items-center justify-center p-4' : 'inset-0 justify-end'}`}>
      <div className={`bg-white shadow-2xl flex flex-col ${maximized ? 'h-full w-full max-w-5xl rounded-2xl' : 'h-full w-full max-w-md'}`}>
        {/* Header: Blue Theme */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white p-4 flex items-center justify-between border-b border-blue-950">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold tracking-tight">ORZO Support</h3>
                <span className="text-[10px] bg-blue-700/80 text-blue-100 px-2 py-0.5 rounded-full border border-blue-500/50 font-semibold">
                  Platform Assistant
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Linguistic Guidance & Spoken Dialect Identifier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMinimized(true)} className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 cursor-pointer" title="Minimize">
              <Minus className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setMaximized((open) => !open)} className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 cursor-pointer" title={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 pt-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Platform Support Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('audio_id')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'audio_id'
                ? 'border-blue-600 text-blue-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Mic className="w-4 h-4 text-red-600" />
            <span>Record & Identify Dialect</span>
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            {/* Messages Scroll Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start space-x-2.5 ${
                    m.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.sender === 'orzo' && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                      O
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-gray-100 text-gray-800 rounded-tl-xs border border-gray-200'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>

                    {m.audioResult && (
                      <div className="mt-3 pt-2.5 border-t border-gray-200 flex flex-col space-y-2">
                        <button
                          onClick={() => handlePreFillRequest(m.audioResult.identifiedLanguageCode)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          <span>Request {m.audioResult.languageName} Interpreter</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div
                      className={`text-[9px] mt-1 text-right ${
                        m.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center space-x-2 text-xs text-gray-500 pl-9">
                  <Sparkles className="w-4 h-4 text-blue-500 animate-spin" />
                  <span>ORZO Support is preparing response...</span>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center space-x-2 overflow-x-auto text-[11px] text-gray-600">
              <span className="font-semibold text-gray-400 shrink-0">Quick Ask:</span>
              <button
                onClick={() => handleSendMessage('Which Ethiopian languages are currently supported?')}
                className="bg-white border border-gray-300 rounded-full px-2.5 py-1 hover:border-blue-600 shrink-0 cursor-pointer"
              >
                Supported Languages
              </button>
              <button
                onClick={() => handleSendMessage('How does interpreter matching use ratings?')}
                className="bg-white border border-gray-300 rounded-full px-2.5 py-1 hover:border-blue-600 shrink-0 cursor-pointer"
              >
                Matching
              </button>
              <button
                onClick={() => handleSendMessage('How do I use speakerphone mode?')}
                className="bg-white border border-gray-300 rounded-full px-2.5 py-1 hover:border-blue-600 shrink-0 cursor-pointer"
              >
                Speakerphone Mode
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-gray-200 flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about languages, workflows, or dispatch..."
                className="flex-1 text-xs border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* TAB 2: AUDIO RECORDING & IDENTIFY LANGUAGE */
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950">
              <div className="font-bold flex items-center space-x-1.5 text-blue-900 mb-1">
                <Volume2 className="w-4 h-4 text-blue-600" />
                <span>Audio Dialect Identification</span>
              </div>
              <p className="leading-relaxed text-[11px] text-blue-800">
                Record the client speaking or select a field audio sample. ORZO identifies phonetic features and dialect variants to match the correct language.
              </p>
            </div>

            {/* Recording Console */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                {isRecording && (
                  <span className="absolute -inset-2 rounded-full bg-red-600/40 animate-ping" />
                )}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isRecording ? 'bg-red-600 text-white' : 'bg-blue-600 text-white shadow-lg'
                  }`}
                >
                  <Mic className="w-10 h-10" />
                </div>
              </div>

              {isRecording ? (
                <div>
                  <div className="text-xl font-mono font-bold text-red-400">
                    Recording: 00:{recordingSeconds.toString().padStart(2, '0')}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Speak into microphone...</p>
                </div>
              ) : recordedAudioUrl ? (
                <div>
                  <div className="text-sm font-bold text-blue-400">Audio Captured</div>
                  <audio controls src={recordedAudioUrl} className="mt-2 h-8 w-60" />
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold">Ready to Record</div>
                  <p className="text-xs text-slate-400 mt-0.5">Captures voice for language identification</p>
                </div>
              )}

              <div className="flex items-center space-x-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-transform hover:scale-105 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{recordedAudioUrl ? 'Record Again' : 'Start Recording'}</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/50 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-red-400" />
                    <span>Stop Recording</span>
                  </button>
                )}

                {recordedAudioUrl && !isRecording && (
                  <button
                    onClick={() => handleAnalyzeAudio()}
                    disabled={analyzingAudio}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-transform hover:scale-105 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{analyzingAudio ? 'Analyzing...' : 'Identify Language'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Field Audio Samples */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                <span>Or Select Sample Recording:</span>
                <span className="text-[10px] text-gray-400">Preset Dialects</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'oromo_sample', name: 'Afaan Oromoo', sub: 'Clinical Triage Sample' },
                  { id: 'tigrinya_sample', name: 'Tigrinya (ትግርኛ)', sub: 'Court Hearing Sample' },
                  { id: 'somali_sample', name: 'Somali', sub: 'Civil Intake Sample' },
                  { id: 'sidama_sample', name: 'Sidama', sub: 'Regional Center Sample' },
                ].map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleAnalyzeAudio(sample.id, sample.name)}
                    disabled={analyzingAudio}
                    className="p-3 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-gray-900 group-hover:text-blue-900">
                      <span>{sample.name}</span>
                      <Play className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{sample.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis Result Card */}
            {audioResult && (
              <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-md">
                      IDENTIFIED
                    </span>
                    <h4 className="text-base font-extrabold text-blue-950">
                      {audioResult.languageName} ({audioResult.nativeName})
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-300">
                    {audioResult.confidencePercent}% Confidence
                  </span>
                </div>

                <div className="text-xs text-gray-700 space-y-1">
                  <div>
                    <strong>Dialect:</strong> {audioResult.dialectVariant}
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-200 mt-1 italic text-blue-950">
                    "{audioResult.transcriptSnippet}"
                  </div>
                </div>

                <div className="text-[11px] text-blue-900 bg-blue-100/70 p-2.5 rounded-lg border border-blue-200">
                  <strong>Cues:</strong> {audioResult.linguisticCharacteristics}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handlePreFillRequest(audioResult.identifiedLanguageCode)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <span>Request {audioResult.languageName} Interpreter</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
