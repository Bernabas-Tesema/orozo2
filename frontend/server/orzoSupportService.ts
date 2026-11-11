import { db } from './db';

const HASAB_CHAT = 'https://api.hasab.ai/api/chat';
const HASAB_TRANSLATE = 'https://api.hasab.ai/api/translate';
const HASAB_AUDIO = [
  'https://api.hasab.ai/api/v1/upload-audio',
  'https://hasab.co/api/v1/upload-audio',
];

function livePlatformSnapshot(): string {
  const activeLanguages = db.languages.filter((language) => language.isActive);
  const openRequests = db.requests.filter((request) =>
    ['submitted', 'validating', 'matching', 'pending_coordinator', 'unresolved'].includes(request.status),
  );
  const available = db.interpreters.filter(
    (interpreter) => interpreter.verificationState === 'verified' && interpreter.availability === 'available',
  );
  return `
Live data from the ORZO database:
- Active languages (${activeLanguages.length}): ${activeLanguages.map((language) => `${language.name} / ${language.nativeName} [${language.code}]`).join('; ')}
- Open dispatch requests: ${openRequests.length}${openRequests.length ? ` (${openRequests.map((request) => `${request.reference} ${request.status} ${request.sourceLanguage}->${request.targetLanguage}`).join(', ')})` : ''}
- Verified interpreters available now: ${available.length}${available.length ? ` (${available.map((interpreter) => interpreter.fullName).join(', ')})` : ''}
Use these facts when the user asks what is happening on the platform. Do not invent queue counts.`;
}
const ELIP_PLATFORM_KNOWLEDGE = `
You are ORZO Support (የኦርዞ የደንበኞች ድጋፍ), the official intelligent customer support and linguistic assistant for the Ethiopian Language Interpretation Platform (ELIP).
Your mission is to assist healthcare professionals (e.g., Tikur Anbessa Hospital, regional clinics), legal staff (Federal Supreme Court, regional courts), immigration officers (UNHCR / Dollo Ado / Gambella), NGOs, and interpreters.

Platform Architecture & Core Knowledge:
1. Purpose: Secure, reliable human interpretation coordination for organizations across Ethiopia.
2. In-Scope User Roles:
   - Client / Requester: Creates emergency or scheduled interpretation requests, tracks status, enters live WebRTC session room, provides feedback.
   - Certified Interpreter: Manages verified language pairs and credentials, toggles availability (Available/Busy/Offline), accepts/rejects assignments, conducts interpretation, submits completion reports.
   - Supervisor / Operations Coordinator: Monitors live dispatch queues, resolves unknown-language escalations, manually overrides assignments, reviews flagged or disputed sessions.
   - Platform Administrator: Manages national language catalog, verifies interpreter accreditations, configures timeouts and telecom presets, reviews immutable security audit logs.
3. Supported Ethiopian Languages in Catalog:
   - Amharic (አማርኛ) [Ethiopic script] - Variants: Gondar, Wollo, Shewa, Gojjam
   - Afaan Oromoo [Latin/Qubee script] - Variants: Central (Shewa), Western (Wollega), Eastern (Harar), Southern (Boran)
   - Tigrinya (ትግርኛ) [Ethiopic script] - Variants: Enderta, Adwa, Agame, Tembien
   - Somali (Af-Soomaali) [Latin script] - Variants: Ogaden, Jijiga, Shinile
   - Sidama (Sidaamu Afoo) [Latin script] - Variants: Hawassa, Aleta Wondo, Yirgalem
   - Wolaytta (Wolayttatto Doonaa) [Latin script] - Variants: Soddo, Areka, Boditi
   - Gurage (ጉራጊኛ) [Ethiopic script] - Variants: Sebat Bet, Silt'e, Kistane
   - Afar (Qafaraf) [Latin script]
   - Hadiyya (Hadiyyisa) [Latin script]
   - Gamo (Gamotto) [Latin script]
   - English & Arabic (العربية)
4. Critical Safety & Operating Constraints (SRS v1.0):
   - SRS Section 7.2: Urgent medical care or emergency response MUST NEVER be delayed while searching for an interpreter.
   - SRS Section 7.3 & FR-017: If a language is unknown or uncertain, NEVER guess. Escalate directly to a human coordinator.
   - SRS Section 7.4: Audio/video recording is STRICTLY DISABLED by default. Any recording requires written legal policy approval, patient/witness consent, and retention rules.
   - SRS Section 8.6: Staff-Assisted Speakerphone Mode allows institutional terminals to connect patients without personal smartphones.
   - SRS Section 3.13: Organization administration and billing dashboards are excluded from this release.

5. Leadership:
   - Estif is the founder and CEO of ORZO Translation.
   - He built ORZO so hospitals, courts, immigration desks, and public services across Ethiopia can reach accredited human interpreters.
   - He leads the Ethiopian Language Interpretation Platform: a request is matched to a verified interpreter for the language and setting, then the conversation continues by audio, video, or staff-assisted speakerphone.
   - He holds the service to two rules: never guess an unknown language, and never delay urgent care while an interpreter is being found.

Always answer concisely, warmly, and helpfully in the user's language (English, Amharic / አማርኛ, Afaan Oromoo, or Tigrinya / ትግርኛ).
Never mention Gemini, Hasab, Google, or any other model or vendor. You are only ORZO Support.
`;

const ESTIF_ANSWER = `Estif is the founder and CEO of ORZO Translation. He started the company so hospitals, courts, immigration desks, and public services across Ethiopia can reach an accredited interpreter when a patient, witness, or client does not share the staff member's language. He leads the Ethiopian Language Interpretation Platform: a desk creates a request, ORZO matches a verified interpreter, and the conversation continues by audio, video, or a staff-assisted speakerphone. Under his direction the service keeps two rules. Staff never guess an unknown language, and urgent care is never delayed while an interpreter is being found. The catalog he built the company around includes Amharic, Afaan Oromoo, Tigrinya, Somali, Sidama, Wolaytta, and the other languages of Ethiopia.`;

const ORZO_ANSWER = `ORZO Translation is the Ethiopian language interpretation service founded and led by Estif, its CEO. Hospitals, courts, immigration offices, and public desks use it when someone needs a human interpreter. Staff open a request, choose the language or mark it unknown, and ORZO matches a verified interpreter for that language and setting. The session can be audio, video, or a speakerphone at the institution's own terminal. Session recording stays off unless the law allows it and the people in the room consent. If the language is uncertain, the request goes to a coordinator. ORZO does not guess.`;

function knownAnswer(message: string): string | null {
  const query = message.toLowerCase();
  const aboutEstif = /\bestif\b/.test(query) || message.includes('እስጢፍ') || message.includes('እስቲፍ');
  if (aboutEstif) return ESTIF_ANSWER;
  const aboutCompany = /orozo|orzo|ኦርዞ/.test(query) && /(what|who|about|tell|company|translation|platform|service|ምን)/.test(query);
  if (aboutCompany) return ORZO_ANSWER;
  return null;
}

function asOrzoVoice(text: string): string {
  return text
    .replace(/hasab\s*ai/gi, 'ORZO Support')
    .replace(/\bgemini\b/gi, 'ORZO Support')
    .replace(/\bhasab\b/gi, 'ORZO Support')
    .replace(/\bgoogle\b/gi, 'ORZO');
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AudioIdentificationResult {
  identifiedLanguageCode: string;
  languageName: string;
  nativeName: string;
  script: string;
  dialectVariant: string;
  confidencePercent: number;
  transcriptSnippet: string;
  linguisticCharacteristics: string;
  highStakesWarning: boolean;
  recommendedAction: string;
  engine?: string;
}

const LOCALE_NAME: Record<string, { name: string; hasab: string; script: boolean }> = {
  am: { name: 'Amharic', hasab: 'amh', script: true },
  om: { name: 'Afaan Oromoo', hasab: 'orm', script: false },
  ti: { name: 'Tigrinya', hasab: 'tig', script: true },
  so: { name: 'Somali', hasab: 'som', script: false },
  en: { name: 'English', hasab: 'eng', script: false },
};

function hasabKey() {
  const key = String(process.env.HASAB_API_KEY || '').trim();
  return key || '';
}

function geminiKey() {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key || key.includes('MY_GEMINI_API_KEY')) return '';
  return key;
}

function textFromHasab(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  const message = record.message;
  if (message && typeof message === 'object' && typeof (message as { content?: unknown }).content === 'string') {
    return (message as { content: string }).content.trim();
  }
  if (typeof message === 'string') return message.trim();
  for (const key of ['content', 'response', 'text', 'reply']) {
    if (typeof record[key] === 'string' && record[key]) return String(record[key]).trim();
  }
  return '';
}

function findLabeledText(value: unknown, labels: string[], depth = 0): string {
  if (!value || depth > 5) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLabeledText(item, labels, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const label of labels) {
    const item = record[label];
    if (typeof item === 'string' && item.trim().length > 1) return item.trim();
  }
  for (const item of Object.values(record)) {
    const found = findLabeledText(item, labels, depth + 1);
    if (found) return found;
  }
  return '';
}

async function askHasab(message: string): Promise<string> {
  const key = hasabKey();
  if (!key) return '';
  const response = await fetch(HASAB_CHAT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: 'hasab-1-lite',
      message,
      stream: false,
      temperature: 0.3,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Hasab chat returned ${response.status}`);
  return textFromHasab(await response.json());
}

async function translateHasab(text: string, target: string): Promise<string> {
  const key = hasabKey();
  if (!key || !text.trim()) return '';
  const response = await fetch(HASAB_TRANSLATE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ text, source_language: 'eng', target_language: target }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return '';
  const data = await response.json();
  return findLabeledText(data, ['translated_text', 'translation', 'text']);
}

const ENGLISH_WORDS = new Set([
  'the', 'and', 'is', 'are', 'to', 'of', 'a', 'for', 'in', 'that', 'this', 'with', 'you', 'your',
  'can', 'not', 'never', 'when', 'while', 'an', 'or', 'from', 'be', 'it', 'on', 'as', 'by', 'at',
  'do', 'does', 'how', 'what', 'who', 'must', 'will', 'have', 'has',
]);

function looksEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length < 6) return /[a-z]/i.test(text) && !/[\u1200-\u137F]/.test(text);
  const hits = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  return hits / words.length >= 0.12;
}

async function inReplyLanguage(text: string, locale: string): Promise<string> {
  const language = LOCALE_NAME[locale] || LOCALE_NAME.en;
  if (!text.trim() || language.hasab === 'eng') return text;
  const alreadyThere = language.script ? /[\u1200-\u137F]/.test(text) : !looksEnglish(text);
  if (alreadyThere) return text;
  try {
    const translated = await translateHasab(text, language.hasab);
    if (translated) return translated;
  } catch (error) {
    console.warn('Translation failed:', error instanceof Error ? error.message : error);
  }
  return text;
}

async function askGemini(contents: string, systemInstruction: string): Promise<string> {
  const key = geminiKey();
  if (!key) return '';
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction },
  });
  return response.text?.trim() || '';
}

async function transcribeHasab(audioBase64: string): Promise<string> {
  const key = hasabKey();
  if (!key) return '';
  const cleaned = audioBase64.replace(/^data:audio\/[\w.+-]+;base64,/, '');
  const bytes = Buffer.from(cleaned, 'base64');
  if (bytes.length < 80) return '';
  for (const url of HASAB_AUDIO) {
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(bytes)], { type: 'audio/webm' }), 'clip.webm');
      form.append('transcribe', 'true');
      form.append('translate', 'true');
      form.append('summarize', 'false');
      form.append('language', 'auto');
      form.append('source_language', 'auto');
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        body: form,
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) continue;
      const transcript = findLabeledText(await response.json(), ['transcription', 'transcript', 'text', 'translated_text', 'original_text']);
      if (transcript) return transcript;
    } catch (error) {
      console.warn('Hasab transcription failed:', error instanceof Error ? error.message : error);
    }
  }
  return '';
}

function parseLanguageJson(text: string): AudioIdentificationResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as AudioIdentificationResult;
    if (!parsed.languageName || !parsed.identifiedLanguageCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

function guideAnswer(userMessage: string): string {
  const query = userMessage.toLowerCase();
  if (query.includes('language') || query.includes('dialect') || query.includes('ቋንቋ')) {
    const names = db.languages
      .filter((language) => language.isActive)
      .map((language) => `${language.name} (${language.nativeName})`)
      .join(', ');
    return `The live language catalog has ${db.languages.filter((language) => language.isActive).length} active languages: ${names}. If a language is unknown, do not guess. Use Unknown Language or the audio identifier so a supervisor can identify it.`;
  }
  if (query.includes('emergency') || query.includes('urgent') || query.includes('ህክምና')) {
    return 'Urgent medical care or courtroom emergency action must never be delayed while searching for an interpreter. Emergency triage requests are prioritized and skip the normal queue.';
  }
  if (query.includes('record') || query.includes('audio') || query.includes('video')) {
    return 'Session recording is disabled by default to protect patient and witness confidentiality. Any recording requires prior legal approval, consent, and strict access controls.';
  }
  if (query.includes('phone') || query.includes('speaker') || query.includes('mobile')) {
    return 'Staff-assisted speakerphone mode lets hospitals and courts connect a patient or witness who does not have a personal phone through the institution terminal.';
  }
  return 'ORZO Support can help with request intake, the Ethiopian language catalog, interpreter qualifications, and the supervisor queue. You can also record a short clip so the language can be identified.';
}

export async function askOrzoSupport(
  userMessage: string,
  chatHistory: ChatMessage[] = [],
  locale = 'en',
): Promise<{ text: string; engine: 'hasab' | 'gemini' | 'guide' }> {
  const language = LOCALE_NAME[locale] || LOCALE_NAME.en;
  const known = knownAnswer(userMessage);
  if (known) {
    const text = await inReplyLanguage(known, locale);
    return { text: asOrzoVoice(text), engine: 'guide' };
  }
  const history = chatHistory
    .slice(-6)
    .map((item) => `${item.role === 'user' ? 'User' : 'ORZO'}: ${item.content}`)
    .join('\n');
  const prompt = `${ELIP_PLATFORM_KNOWLEDGE}
${livePlatformSnapshot()}

Answer the latest user question in ${language.name}. Follow the rules above, including: never guess an unknown language, and never delay urgent care while searching for an interpreter. Use the live database facts and do not invent queue counts.
${history ? `\nRecent conversation:\n${history}\n` : ''}
User question: ${userMessage}`;
  const openRequests = db.requests.filter((request) =>
    ['submitted', 'validating', 'matching', 'pending_coordinator', 'unresolved'].includes(request.status),
  ).length;
  const availableInterpreters = db.interpreters.filter(
    (interpreter) => interpreter.verificationState === 'verified' && interpreter.availability === 'available',
  ).length;
  const question = userMessage.replace(/\s+/g, ' ').trim().slice(0, 140);
  const hasabBrief = `Answer in ${language.name}. Unknown language: escalate, never guess. Do not delay urgent care. Open requests ${openRequests}. Interpreters available ${availableInterpreters}. Question: ${question}`.slice(0, 300);

  let text = '';
  let engine: 'hasab' | 'gemini' | 'guide' = 'guide';
  try {
    text = await askHasab(hasabBrief);
    if (text) engine = 'hasab';
  } catch (error) {
    console.warn('Hasab chat failed:', error instanceof Error ? error.message : error);
  }
  if (!text) {
    try {
      text = await askGemini(prompt, `You are ORZO Support. Answer in ${language.name}. Never mention Gemini, Hasab, Google, or any other model. Use the instructions in the user message.`);
      if (text) engine = 'gemini';
    } catch (error) {
      console.warn('Gemini chat failed:', error instanceof Error ? error.message : error);
    }
  }
  if (!text) {
    text = guideAnswer(userMessage);
    engine = 'guide';
  }
  text = await inReplyLanguage(text, locale);
  return { text: asOrzoVoice(text), engine };
}

async function transcribeQuestion(audioBase64: string): Promise<string> {
  const fromHasab = await transcribeHasab(audioBase64);
  if (fromHasab) return fromHasab.replace(/^["']|["']$/g, '').trim();
  const key = geminiKey();
  if (!key) return '';
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: audioBase64.replace(/^data:audio\/[\w.+-]+;base64,/, ''),
            },
          },
          { text: 'Transcribe the spoken question exactly. Return only the words that were spoken.' },
        ],
      },
    ],
  });
  return (response.text || '').replace(/^["']|["']$/g, '').trim();
}

export async function answerSpokenQuestion(
  audioBase64: string,
  chatHistory: ChatMessage[] = [],
  locale = 'en',
): Promise<{ transcript: string; text: string }> {
  const transcript = await transcribeQuestion(audioBase64);
  if (!transcript) {
    throw new Error('ORZO Support could not hear a question in that recording. Please try again closer to the microphone.');
  }
  const answer = await askOrzoSupport(transcript, chatHistory, locale);
  return { transcript, text: answer.text };
}

function cannedSample(sampleId?: string): AudioIdentificationResult | null {
  if (sampleId === 'oromo_sample') {
    return {
      identifiedLanguageCode: 'orm',
      languageName: 'Afaan Oromoo',
      nativeName: 'Afaan Oromoo',
      script: 'Latin (Qubee)',
      dialectVariant: 'Western Wollega / Central Shewa dialect group',
      confidencePercent: 96,
      transcriptSnippet: '"Akkam jirtu? Dhukkubbiin kun na dhibeera, qoricha naaf kennaa..." (How are you? This pain is troubling me, please provide medication...)',
      linguisticCharacteristics: 'Cushitic Afroasiatic structure, distinct gemination, vowel elongation, and typical Oromo clinical intake vocabulary.',
      highStakesWarning: false,
      recommendedAction: 'Ready to connect certified Oromo medical interpreter.',
      engine: 'sample',
    };
  }

  if (sampleId === 'tigrinya_sample') {
    return {
      identifiedLanguageCode: 'tir',
      languageName: 'Tigrinya',
      nativeName: 'ትግርኛ',
      script: 'Ethiopic (ግዕዝ)',
      dialectVariant: 'Central / Adwa & Enderta variant',
      confidencePercent: 94,
      transcriptSnippet: '"ሰላም ዶክተር፣ ርእሰይ የሕምመኒ ኣሎ፣ መዓስ ኢዩ ዝጀመረ..." (Peace Doctor, I have a headache, when did it begin...)',
      linguisticCharacteristics: 'North Ethio-Semitic phonology, pharyngeal and ejective consonants [t\', k\', s\'], Ethiopic morphological markers.',
      highStakesWarning: false,
      recommendedAction: 'Ready to connect accredited Tigrinya judicial/clinical interpreter.',
      engine: 'sample',
    };
  }

  if (sampleId === 'somali_sample') {
    return {
      identifiedLanguageCode: 'som',
      languageName: 'Somali',
      nativeName: 'Af-Soomaali',
      script: 'Latin',
      dialectVariant: 'Jijiga / Eastern Somali regional dialect',
      confidencePercent: 93,
      transcriptSnippet: '"Maxaa dhacay? Qoyskaygu xuduudka ayay joogaan, caawimaad baan u baahanahay..." (What happened? My family is at the border, I need assistance...)',
      linguisticCharacteristics: 'Lowland East Cushitic, distinctive uvular [q] and pharyngeal [x, c] sounds with Somali intake syntax.',
      highStakesWarning: false,
      recommendedAction: 'Ready to connect Somali humanitarian/medical interpreter.',
      engine: 'sample',
    };
  }

  if (sampleId === 'sidama_sample') {
    return {
      identifiedLanguageCode: 'sid',
      languageName: 'Sidama',
      nativeName: 'Sidaamu Afoo',
      script: 'Latin',
      dialectVariant: 'Hawassa / Aleta Wondo Highland variant',
      confidencePercent: 91,
      transcriptSnippet: '"Keere heedhino? Ani fayyimma\'ya la\'annoeti danna korooshsha..." (Peace be with you? Concerning my health condition...)',
      linguisticCharacteristics: 'Highland East Cushitic, glottalized ejective stops, distinctive Sidama case suffixes.',
      highStakesWarning: false,
      recommendedAction: 'Ready to connect certified Sidama regional interpreter.',
      engine: 'sample',
    };
  }
  return null;
}

export async function identifyAudioLanguage(
  audioBase64?: string,
  sampleId?: string,
  clientNotes?: string,
): Promise<AudioIdentificationResult> {
  const canned = cannedSample(sampleId);
  if (canned && !audioBase64) return canned;

  const catalog = db.languages
    .filter((language) => language.isActive)
    .map((language) => `${language.code}: ${language.name} / ${language.nativeName}`)
    .join('\n');
  const instruction = `Identify the Ethiopian language in this material. Choose a code from this catalog when it fits:
${catalog}
Return ONLY JSON with keys identifiedLanguageCode, languageName, nativeName, script, dialectVariant, confidencePercent, transcriptSnippet, linguisticCharacteristics, highStakesWarning, recommendedAction.
If you are not sure, set confidencePercent below 60, highStakesWarning true, and recommendedAction to escalate to a human coordinator. Never invent a confident match.`;

  let transcript = '';
  if (audioBase64) transcript = await transcribeHasab(audioBase64);
  const notes = [clientNotes, transcript ? `Transcript: ${transcript}` : ''].filter(Boolean).join('\n');

  try {
    const key = geminiKey();
    if (key && audioBase64) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/webm',
                  data: audioBase64.replace(/^data:audio\/[\w.+-]+;base64,/, ''),
                },
              },
              { text: `${instruction}\n${notes}` },
            ],
          },
        ],
      });
      const parsed = parseLanguageJson(response.text || '');
      if (parsed) return { ...parsed, engine: transcript ? 'hasab+gemini' : 'gemini', transcriptSnippet: parsed.transcriptSnippet || transcript };
    }
  } catch (error) {
    console.warn('Gemini audio identification failed:', error instanceof Error ? error.message : error);
  }

  if (transcript || notes) {
    try {
      const classified = await askHasab(`${instruction}\n${notes}`);
      const parsed = parseLanguageJson(classified);
      if (parsed) return { ...parsed, engine: 'hasab', transcriptSnippet: parsed.transcriptSnippet || transcript };
    } catch (error) {
      console.warn('Hasab language classification failed:', error instanceof Error ? error.message : error);
    }
  }

  if (canned) return canned;
  return {
    identifiedLanguageCode: '',
    languageName: 'Not identified',
    nativeName: '',
    script: '',
    dialectVariant: '',
    confidencePercent: 0,
    transcriptSnippet: transcript,
    linguisticCharacteristics: transcript
      ? 'A transcript was produced, but it could not be matched to the catalog with confidence.'
      : 'No language model returned a reliable match for this clip.',
    highStakesWarning: true,
    recommendedAction: 'Do not guess. Escalate this clip to a supervisor.',
    engine: transcript ? 'hasab' : 'none',
  };
}
