import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  InterpretationRequest,
  Assignment,
  InterpretationSession,
  SessionParticipant,
  CompletionReport,
  PlatformNotification,
  AuditLog,
  PlatformSettings,
  ServiceCategory
} from './types';

function language(
  code: string,
  name: string,
  nativeName: string,
  script: SupportedLanguage['script'],
  variants: string[] = []
): SupportedLanguage {
  return { code, name, nativeName, script, variants, isActive: true };
}

// The first 20 are the most widely used. The rest follow the supplied catalog.
// English and Arabic stay at the end so requests can still be interpreted into them.
export const INITIAL_LANGUAGES: SupportedLanguage[] = [
  language('orm', 'Oromo', 'Afaan Oromoo', 'Latin', ['Central (Shewa)', 'Western (Wollega)', 'Eastern (Harar)', 'Southern (Boran)']),
  language('amh', 'Amharic', 'አማርኛ', 'Ethiopic', ['Gondar', 'Wollo', 'Shewa', 'Gojjam']),
  language('som', 'Somali', 'Af-Soomaali', 'Latin', ['Ogaden', 'Jijiga', 'Shinile']),
  language('tir', 'Tigrinya', 'ትግርኛ', 'Ethiopic', ['Enderta', 'Adwa', 'Agame', 'Tembien']),
  language('sid', 'Sidama', 'Sidaamu Afoo', 'Latin', ['Hawassa', 'Aleta Wondo', 'Yirgalem']),
  language('wal', 'Wolaytta', 'Wolayttatto Doonaa', 'Latin', ['Soddo', 'Areka', 'Boditi']),
  language('aar', 'Afar', 'Qafaraf', 'Latin', ['Northern', 'Central', 'Southern (Assab)']),
  language('gam', 'Gamo', 'Gamotto', 'Latin', ['Arba Minch', 'Chencha']),
  language('had', 'Hadiyya', 'Hadiyyisa', 'Latin', ['Hosanna', 'Lemo', 'Shashogo']),
  language('ktb', 'Kambaata', 'Kambaatissata', 'Latin'),
  language('drs', 'Gedeo', 'Gedeuffa', 'Latin'),
  language('stv', "Silt'e", 'ስልጥኛ', 'Ethiopic', ['Ulbareg', 'Inneqor', 'Wolane']),
  language('gof', 'Gofa', 'Gofatho', 'Latin'),
  language('dwr', 'Dawro', 'Dawrotsuwa', 'Latin'),
  language('kbr', 'Kafa', 'Kafi noono', 'Latin'),
  language('har', 'Harari', 'ሃራሪ', 'Ethiopic'),
  language('aiw', 'Aari', 'Aari', 'Latin'),
  language('bcq', 'Bench', 'Benchnon', 'Latin'),
  language('kxc', 'Konso', 'Komso', 'Latin'),
  language('guk', 'Gumuz', 'Gumuz', 'Latin'),
  language('awn', 'Awngi', 'Awngi', 'Latin'),
  language('ahg', 'Qimant', 'Qimant', 'Latin'),
  language('xan', 'Xamtanga', 'Xamtanga', 'Latin'),
  language('bji', 'Burji', 'Burji', 'Latin'),
  language('alw', 'Alaba', 'Alaba', 'Latin'),
  language('liq', 'Libido', 'Libido', 'Latin'),
  language('ssy', 'Saho', 'Saho', 'Latin'),
  language('arv', 'Arbore', 'Arbore', 'Latin'),
  language('bsw', 'Baiso', 'Baiso', 'Latin'),
  language('dsh', 'Daasanach', 'Daasanach', 'Latin'),
  language('gdl', 'Dirasha', 'Dirasha', 'Latin'),
  language('dox', 'Bussa', 'Bussa', 'Latin'),
  language('gwd', 'Gawwada', 'Gawwada', 'Latin'),
  language('tsb', 'Tsamai', 'Tsamai', 'Latin'),
  language('agj', 'Argobba', 'አርጎባ', 'Ethiopic'),
  language('zay', 'Zay', 'ዛይ', 'Ethiopic'),
  language('gru', 'Soddo', 'እኩኩ', 'Ethiopic'),
  language('sgw', 'Chaha', 'ቻሃ', 'Ethiopic'),
  language('sgz', 'Ezha', 'እዣ', 'Ethiopic'),
  language('gmx', 'Gumer', 'ጉመር', 'Ethiopic'),
  language('gqa', 'Gura', 'ጉራ', 'Ethiopic'),
  language('ior', 'Inor', 'እነር', 'Ethiopic'),
  language('gye', 'Gyeto', 'ጌቶ', 'Ethiopic'),
  language('end', 'Endegen', 'እንደገኝ', 'Ethiopic'),
  language('mvz', 'Mesqan', 'መስቃን', 'Ethiopic'),
  language('muh', 'Muher', 'ሙኼር', 'Ethiopic'),
  language('myo', 'Anfillo', 'Anfillo', 'Latin'),
  language('myf', 'Bambassi', 'Bambassi', 'Latin'),
  language('bst', 'Basketo', 'Basketo', 'Latin'),
  language('bwo', 'Boro (Shinasha)', 'Borna', 'Latin'),
  language('cra', 'Chara', 'Chara', 'Latin'),
  language('dim', 'Dime', 'Dime', 'Latin'),
  language('mdx', 'Dizi', 'Dizi', 'Latin'),
  language('doz', 'Dorze', 'Dorze', 'Latin'),
  language('gza', 'Ganza', 'Ganza', 'Latin'),
  language('gyl', 'Gayil', 'Gayil', 'Latin'),
  language('amf', 'Hamer-Banna', 'Hamer-Banna', 'Latin'),
  language('hoz', 'Hozo', 'Hozo', 'Latin'),
  language('kcx', 'Kachama-Ganjule', 'Kachama-Ganjule', 'Latin'),
  language('kxh', 'Karo', 'Karo', 'Latin'),
  language('kqy', 'Koorete', 'Koorete', 'Latin'),
  language('mdy', 'Male', 'Male', 'Latin'),
  language('mfx', 'Melo', 'Melo', 'Latin'),
  language('noz', 'Nayi', 'Nayi', 'Latin'),
  language('oyd', 'Oyda', 'Oyda', 'Latin'),
  language('sze', 'Seze', 'Seze', 'Latin'),
  language('she', 'Sheko', 'Sheko', 'Latin'),
  language('jnj', 'Yemsa', 'Yemsa', 'Latin'),
  language('zayz', 'Zayse-Zergulla', 'Zayse-Zergulla', 'Latin'),
  language('anu', 'Anuak', 'Anuak', 'Latin'),
  language('wti', 'Berta', 'Berta', 'Latin'),
  language('koe', 'Kacipo-Balesi', 'Kacipo-Balesi', 'Latin'),
  language('xom', 'Komo', 'Komo', 'Latin'),
  language('kun', 'Kunama', 'Kunama', 'Latin'),
  language('kmq', 'Kwama', 'Kwama', 'Latin'),
  language('xwg', 'Kwegu', 'Kwegu', 'Latin'),
  language('mpe', 'Majang', 'Majang', 'Latin'),
  language('mym', "Me'en", "Me'en", 'Latin'),
  language('mur', 'Murle', 'Murle', 'Latin'),
  language('muz', 'Mursi', 'Mursi', 'Latin'),
  language('nus', 'Nuer', 'Nuer', 'Latin'),
  language('nnj', 'Nyangatom', 'Nyangatom', 'Latin'),
  language('lgn', 'Opuuo', 'Opuuo', 'Latin'),
  language('sbf', 'Shabo', 'Shabo', 'Latin'),
  language('suq', 'Suri', 'Suri', 'Latin'),
  language('udu', 'Uduk', 'Uduk', 'Latin'),
  language('eng', 'English', 'English', 'Latin', ['International', 'Standard British', 'Standard American']),
  language('ara', 'Arabic', 'العربية', 'Arabic', ['Modern Standard', 'Gulf', 'Yemeni / Red Sea Dialect']),
];

// Pre-seeded Users across all in-scope roles:
// - Organizations/Clients have two distinct accounts: Admin Account & Common Staff Terminal Account
// - Certified Interpreters, Supervisors, and Platform Administrators
export const INITIAL_USERS: User[] = [
  {
    id: 'usr-client-admin-1',
    email: 'admin.bekele@tikuranbessa.gov.et',
    fullName: 'Dr. Solomon Bekele (Hospital Admin)',
    role: 'client',
    clientAccountType: 'organization_admin',
    phone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital (Addis Ababa)',
    status: 'active',
    createdAt: '2026-08-10T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-common-1',
    email: 'triage.desk@tikuranbessa.gov.et',
    fullName: 'Triage desk',
    role: 'client',
    clientAccountType: 'common_terminal',
    phone: '+251 91 123 4599',
    organizationName: 'Tikur Anbessa Specialized Hospital (Addis Ababa)',
    status: 'active',
    createdAt: '2026-08-12T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-admin-2',
    email: 'admin.tadesse@moj.gov.et',
    fullName: 'Meron Tadesse, Legal Director (Court Admin)',
    role: 'client',
    clientAccountType: 'organization_admin',
    phone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    status: 'active',
    createdAt: '2026-08-15T09:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-common-2',
    email: 'registry.desk@moj.gov.et',
    fullName: 'Bench Room 3 Registry (Common Staff Terminal)',
    role: 'client',
    clientAccountType: 'common_terminal',
    phone: '+251 92 234 5699',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    status: 'active',
    createdAt: '2026-08-18T09:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-1',
    email: 'chaltu.kebede@interpreters.et',
    fullName: 'Chaltu Kebede',
    role: 'interpreter',
    phone: '+251 91 555 0101',
    organizationName: 'National Accredited Interpreters Registry',
    status: 'active',
    createdAt: '2026-07-01T11:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-2',
    email: 'berhane.gebre@interpreters.et',
    fullName: 'Berhane Gebremariam',
    role: 'interpreter',
    phone: '+251 91 555 0202',
    organizationName: 'Ethiopian Judicial & Medical Interpreters Corps',
    status: 'active',
    createdAt: '2026-07-05T12:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-3',
    email: 'faduma.omar@interpreters.et',
    fullName: 'Faduma Omar Hassan',
    role: 'interpreter',
    phone: '+251 91 555 0303',
    organizationName: 'Eastern Horn Linguistic Services',
    status: 'active',
    createdAt: '2026-07-12T14:15:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-4',
    email: 'tariku.wonche@interpreters.et',
    fullName: 'Tariku Wonche',
    role: 'interpreter',
    phone: '+251 91 555 0404',
    organizationName: 'Southern Regional Language Guild',
    status: 'active',
    createdAt: '2026-08-01T09:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-super-1',
    email: 'rahel.alemu@elip.et',
    fullName: 'Rahel Alemu',
    role: 'supervisor',
    phone: '+251 91 777 0001',
    organizationName: 'Central Operations Dispatch Centre (Addis Ababa)',
    status: 'active',
    createdAt: '2026-06-01T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-admin-1',
    email: 'admin.dawit@elip.et',
    fullName: 'Dawit Mengistu',
    role: 'platform_admin',
    phone: '+251 91 888 9999',
    organizationName: 'Ministry of Innovation & Technology / ELIP Operations',
    status: 'active',
    createdAt: '2026-05-15T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
];

// Pre-seeded Interpreter Profiles with certified language pairs and qualifications
export const INITIAL_INTERPRETERS: InterpreterProfile[] = [
  {
    id: 'int-1',
    userId: 'usr-interp-1',
    fullName: 'Chaltu Kebede',
    phone: '+251 91 555 0101',
    email: 'chaltu.kebede@interpreters.et',
    supportedLanguages: [
      { languageCode: 'orm', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'public_services', 'ngo_humanitarian', 'education'],
    qualifications: [
      {
        id: 'q-1',
        title: 'Certified Medical Interpreter (Oromifa/Amharic)',
        category: 'healthcare',
        issuingBody: 'Ethiopian Medical Association & Ministry of Health',
        year: 2024,
        verified: true,
        documentRef: 'DOC-EMA-2024-984',
      },
      {
        id: 'q-2',
        title: 'Community & NGO Field Interpretation Diploma',
        category: 'ngo_humanitarian',
        issuingBody: 'Addis Ababa University Institute of Language Studies',
        year: 2022,
        verified: true,
        documentRef: 'DOC-AAU-2022-104',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.9,
    totalSessionsCompleted: 142,
    currentWorkstation: 'Bole Terminal Station #4',
  },
  {
    id: 'int-2',
    userId: 'usr-interp-2',
    fullName: 'Berhane Gebremariam',
    phone: '+251 91 555 0202',
    email: 'berhane.gebre@interpreters.et',
    supportedLanguages: [
      { languageCode: 'tir', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['legal_court', 'immigration', 'healthcare', 'public_services'],
    qualifications: [
      {
        id: 'q-3',
        title: 'Federal Judicial Sworn Interpreter Credential',
        category: 'legal_court',
        issuingBody: 'Federal Supreme Court of Ethiopia',
        year: 2023,
        verified: true,
        documentRef: 'DOC-FSC-2023-772',
      },
      {
        id: 'q-4',
        title: 'Trauma-Informed Legal Intake Certification',
        category: 'immigration',
        issuingBody: 'International Commission of Jurists - East Africa',
        year: 2024,
        verified: true,
        documentRef: 'DOC-ICJ-2024-301',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.95,
    totalSessionsCompleted: 218,
    currentWorkstation: 'Judicial Coordination Hub',
  },
  {
    id: 'int-3',
    userId: 'usr-interp-3',
    fullName: 'Faduma Omar Hassan',
    phone: '+251 91 555 0303',
    email: 'faduma.omar@interpreters.et',
    supportedLanguages: [
      { languageCode: 'som', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'ara', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'immigration', 'ngo_humanitarian'],
    qualifications: [
      {
        id: 'q-5',
        title: 'Refugee and Cross-Border Intake Interpreter',
        category: 'ngo_humanitarian',
        issuingBody: 'UNHCR / IOM Ethiopia Joint Training Board',
        year: 2024,
        verified: true,
        documentRef: 'DOC-UN-2024-551',
      },
      {
        id: 'q-6',
        title: 'Somali-Amharic Clinical Communication Certificate',
        category: 'healthcare',
        issuingBody: 'Jijiga Regional Health Bureau',
        year: 2025,
        verified: true,
        documentRef: 'DOC-JRHB-2025-089',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.88,
    totalSessionsCompleted: 98,
    currentWorkstation: 'Eastern Sector Dispatch Desk',
  },
  {
    id: 'int-4',
    userId: 'usr-interp-4',
    fullName: 'Tariku Wonche',
    phone: '+251 91 555 0404',
    email: 'tariku.wonche@interpreters.et',
    supportedLanguages: [
      { languageCode: 'sid', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'wal', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'public_services', 'education'],
    qualifications: [
      {
        id: 'q-7',
        title: 'Southern Nations Healthcare Interpreter License',
        category: 'healthcare',
        issuingBody: 'Hawassa University Comprehensive Specialized Hospital',
        year: 2023,
        verified: true,
        documentRef: 'DOC-HUCSH-2023-412',
      },
    ],
    verificationState: 'verified',
    availability: 'busy',
    rating: 4.82,
    totalSessionsCompleted: 76,
    currentWorkstation: 'Hawassa Regional Desk',
  },
];

// Initial requests demonstrating various states per SRS Section 8
export const INITIAL_REQUESTS: InterpretationRequest[] = [
  {
    reference: 'REQ-2026-10821',
    requesterId: 'usr-client-common-1',
    requesterName: 'Dr. Solomon Bekele',
    requesterPhone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'orm',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'healthcare',
    urgency: 'emergency',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'assigned',
    minRoutingContext: 'Emergency triage: Patient arriving with acute respiratory trauma, primary speech Oromo only. Need urgent medical triage communication.',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    assignedInterpreterId: 'int-1',
    assignedInterpreterName: 'Chaltu Kebede',
    activeSessionId: 'SES-9921',
  },
  {
    reference: 'REQ-2026-10822',
    requesterId: 'usr-client-common-2',
    requesterName: 'Meron Tadesse, Legal Counsel',
    requesterPhone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    sourceLanguage: 'tir',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'legal_court',
    urgency: 'high',
    modality: 'video',
    scheduleType: 'immediate',
    status: 'matching',
    minRoutingContext: 'Witness testimony examination in civil dispute. Court requires sworn interpreter for formal proceeding.',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    reference: 'REQ-2026-10823',
    requesterId: 'usr-client-3',
    requesterName: 'Khalid Ahmed, Protection Officer',
    requesterPhone: '+251 93 345 6789',
    organizationName: 'UNHCR Dollo Ado Transit Centre',
    sourceLanguage: 'som',
    targetLanguage: 'eng',
    isUnknownLanguage: false,
    serviceCategory: 'immigration',
    urgency: 'standard',
    modality: 'phone_assisted',
    scheduleType: 'scheduled',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    status: 'submitted',
    minRoutingContext: 'Family reunification intake verification at field tent 4. Speakerphone setup on site.',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    reference: 'REQ-2026-10824',
    requesterId: 'usr-client-admin-1',
    requesterName: 'Dr. Solomon Bekele',
    requesterPhone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'unknown',
    targetLanguage: 'amh',
    isUnknownLanguage: true,
    unknownLanguageNotes: 'Patient arrived from rural border area; dialect unrecognized by ward staff. Family says origin is southern Oromia / Guji highland pocket. Sounds like Borana or Guji dialect variant.',
    serviceCategory: 'healthcare',
    urgency: 'emergency',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'pending_coordinator',
    minRoutingContext: 'Pediatric unit intake. Urgent need to identify exact dialect to communicate medication dosages.',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    escalatedToSupervisorAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    escalationReason: 'Unknown language intake flagged - escalated to supervisor coordinator without automated guessing per SRS FR-017 & 7.3.',
  },
  {
    reference: 'REQ-2026-10819',
    requesterId: 'usr-client-admin-2',
    requesterName: 'Meron Tadesse, Legal Counsel',
    requesterPhone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    sourceLanguage: 'sid',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'legal_court',
    urgency: 'standard',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'completed',
    minRoutingContext: 'Deposition review with plaintiff regarding contract terms.',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    assignedInterpreterId: 'int-4',
    assignedInterpreterName: 'Tariku Wonche',
    activeSessionId: 'SES-9915',
  },
  {
    reference: 'REQ-2026-10818',
    requesterId: 'usr-client-common-1',
    requesterName: 'Triage desk',
    requesterPhone: '+251 91 123 4599',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'orm',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'healthcare',
    urgency: 'high',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'completed',
    minRoutingContext: 'Ward round for an Oromo-speaking patient after emergency intake.',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    assignedInterpreterId: 'int-1',
    assignedInterpreterName: 'Chaltu Kebede',
    activeSessionId: 'SES-9910',
  },
];

// Initial Sessions
export const INITIAL_SESSIONS: InterpretationSession[] = [
  {
    id: 'SES-9921',
    requestReference: 'REQ-2026-10821',
    sessionToken: 'SES-TOKEN-e89a24cf',
    status: 'ready_to_join',
    communicationMode: 'audio',
    lowBandwidthMode: true,
    recordingEnabled: false,
    durationSeconds: 0,
    interpreterId: 'int-1',
    interpreterName: 'Chaltu Kebede',
    clientId: 'usr-client-1',
    clientName: 'Dr. Solomon Bekele',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'orm',
    targetLanguage: 'amh',
    serviceCategory: 'healthcare',
    connectionHealth: 'optimal',
    authorizedParticipantIds: ['usr-client-1', 'usr-interp-1'],
  },
  {
    id: 'SES-9915',
    requestReference: 'REQ-2026-10819',
    sessionToken: 'SES-TOKEN-completed-773a',
    status: 'completed',
    communicationMode: 'audio',
    lowBandwidthMode: true,
    recordingEnabled: false,
    startedAt: new Date(Date.now() - 1000 * 60 * 165).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    durationSeconds: 2700,
    interpreterId: 'int-4',
    interpreterName: 'Tariku Wonche',
    clientId: 'usr-client-2',
    clientName: 'Meron Tadesse, Legal Counsel',
    organizationName: 'Federal First Instance Court',
    sourceLanguage: 'sid',
    targetLanguage: 'amh',
    serviceCategory: 'legal_court',
    connectionHealth: 'optimal',
    authorizedParticipantIds: ['usr-client-2', 'usr-interp-4'],
  },
];

// Initial Assignments
export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-901',
    requestReference: 'REQ-2026-10821',
    interpreterId: 'int-1',
    interpreterName: 'Chaltu Kebede',
    assignedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 2).toISOString(),
    response: 'accepted',
    respondedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    outcome: 'accepted',
  },
];

// Initial Completion Reports
export const INITIAL_COMPLETIONS: CompletionReport[] = [
  {
    id: 'cmp-501',
    sessionId: 'SES-9915',
    requestReference: 'REQ-2026-10819',
    interpreterId: 'int-4',
    interpreterName: 'Tariku Wonche',
    outcome: 'completed',
    durationMinutes: 45,
    issueCode: 'none',
    notes: 'Deposition statement interpreted accurately between Sidama speaker and presiding attorney. No dialect barriers encountered.',
    reviewStatus: 'standard',
    clientFeedback: {
      rating: 5,
      comment: 'Very professional legal terminology handling and clear acoustic connection.',
      submittedAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'cmp-500',
    sessionId: 'SES-9910',
    requestReference: 'REQ-2026-10818',
    interpreterId: 'int-1',
    interpreterName: 'Chaltu Kebede',
    outcome: 'completed',
    durationMinutes: 32,
    issueCode: 'none',
    notes: 'Completed bedside interpretation for medication instructions.',
    reviewStatus: 'standard',
    clientFeedback: {
      rating: 5,
      comment: 'Clear and calm during the ward round. The patient understood every instruction.',
      submittedAt: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
  },
];

// Initial Platform Settings
export const INITIAL_SETTINGS: PlatformSettings = {
  assignmentTimeoutSeconds: 45,
  maxAutoRetries: 3,
  emergencyPriorityBypass: true,
  allowDirectRecording: false, // strictly false per SRS FR-016 & 7.4
  maintenanceMode: false,
  telecomLowBandwidthPreset: true, // optimized for Ethio Telecom / Safaricom Ethiopia 3G/4G stability
  systemBannerNotice: 'Platform operational across Addis Ababa, Oromia, Tigray, Somali, and Sidama regional health & judicial hubs.',
};

// Initial Notifications
export const INITIAL_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: 'notif-1',
    recipientId: 'usr-interp-1',
    recipientRole: 'interpreter',
    title: 'Emergency Healthcare Request Assigned',
    message: 'New request REQ-2026-10821: Oromo to Amharic at Tikur Anbessa Hospital.',
    channel: 'in_app',
    status: 'delivered',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    actionUrl: '/interpreter',
  },
  {
    id: 'notif-2',
    recipientId: 'usr-super-1',
    recipientRole: 'supervisor',
    title: 'Unknown Language Escalation Alert',
    message: 'REQ-2026-10824 flagged as unknown language from Tikur Anbessa pediatric unit. Coordinator review required.',
    channel: 'in_app',
    status: 'delivered',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    actionUrl: '/supervisor',
  },
];

// Initial Audit Logs (Strictly preserving non-tamperable security events per SRS FR-066 & 7.5)
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-001',
    correlationId: 'cor-88192a-01',
    actorId: 'usr-admin-1',
    actorName: 'Dawit Mengistu',
    actorRole: 'platform_admin',
    action: 'INTERPRETER_QUALIFICATION_VERIFIED',
    resourceType: 'interpreter_profile',
    resourceId: 'int-1',
    result: 'success',
    timestamp: '2026-08-01T10:14:22Z',
    securityMetadata: {
      ip: '197.156.104.12',
      userAgent: 'ELIP-Console/1.0',
      note: 'Verified Medical credential against Ethiopian Medical Association registry',
    },
  },
  {
    id: 'aud-002',
    correlationId: 'cor-88192a-02',
    actorId: 'usr-client-1',
    actorName: 'Dr. Solomon Bekele',
    actorRole: 'client',
    action: 'REQUEST_SUBMITTED',
    resourceType: 'interpretation_request',
    resourceId: 'REQ-2026-10821',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    securityMetadata: {
      ip: '197.156.98.54',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      note: 'Urgency: emergency; Category: healthcare',
    },
  },
  {
    id: 'aud-003',
    correlationId: 'cor-88192a-03',
    actorId: 'system',
    actorName: 'Dispatch Engine',
    actorRole: 'platform_admin',
    action: 'INTERPRETER_MATCHED_AND_ASSIGNED',
    resourceType: 'assignment',
    resourceId: 'asg-901',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    securityMetadata: {
      note: 'Interpreter Chaltu Kebede matched based on native Oromo, healthcare cert, and live availability.',
    },
  },
  {
    id: 'aud-004',
    correlationId: 'cor-88192a-04',
    actorId: 'usr-client-1',
    actorName: 'Dr. Solomon Bekele',
    actorRole: 'client',
    action: 'UNKNOWN_LANGUAGE_ESCALATED',
    resourceType: 'interpretation_request',
    resourceId: 'REQ-2026-10824',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    securityMetadata: {
      note: 'Flagged as unknown language; routed directly to supervisor workspace per safety protocol.',
    },
  },
];

// In-Memory Database store instance with getter and mutation methods
class DatabaseStore {
  languages: SupportedLanguage[] = [...INITIAL_LANGUAGES];
  users: User[] = [...INITIAL_USERS];
  interpreters: InterpreterProfile[] = [...INITIAL_INTERPRETERS];
  requests: InterpretationRequest[] = [...INITIAL_REQUESTS];
  assignments: Assignment[] = [...INITIAL_ASSIGNMENTS];
  sessions: InterpretationSession[] = [...INITIAL_SESSIONS];
  sessionParticipants: SessionParticipant[] = [];
  completions: CompletionReport[] = [...INITIAL_COMPLETIONS];
  notifications: PlatformNotification[] = [...INITIAL_NOTIFICATIONS];
  auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  settings: PlatformSettings = { ...INITIAL_SETTINGS };

  // Passwords for accounts created by a platform admin. Demo accounts have none.
  private passwords = new Map<string, string>();

  // Current active user session (simulates the authenticated context)
  currentUserId: string | null = 'usr-client-admin-1';

  getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    const user = this.users.find(u => u.id === this.currentUserId);
    return user || null;
  }

  setCurrentUser(userId: string): User {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    this.currentUserId = userId;
    this.logAudit({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'USER_ROLE_SWITCH',
      resourceType: 'user_session',
      resourceId: user.id,
      result: 'success',
      securityMetadata: { note: `Switched active role perspective to ${user.role}` },
    });
    return user;
  }

  logout(): void {
    if (this.currentUserId) {
      const user = this.users.find(u => u.id === this.currentUserId);
      if (user) {
        this.logAudit({
          actorId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          action: 'USER_LOGOUT',
          resourceType: 'user_session',
          resourceId: user.id,
          result: 'success',
          securityMetadata: { note: 'User session logged out' },
        });
      }
    }
    this.currentUserId = null;
  }

  logAudit(entry: Omit<AuditLog, 'id' | 'correlationId' | 'timestamp'>) {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      correlationId: `cor-${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.unshift(newLog);
    // keep maximum 500 audit logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return newLog;
  }

  createNotification(notif: Omit<PlatformNotification, 'id' | 'createdAt'>) {
    const item: PlatformNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...notif,
    };
    this.notifications.unshift(item);
    return item;
  }

  notifyUser(userId: string, notif: Omit<PlatformNotification, 'id' | 'createdAt' | 'recipientId' | 'recipientRole'>) {
    const user = this.users.find((item) => item.id === userId);
    if (!user) return null;
    return this.createNotification({
      ...notif,
      recipientId: user.id,
      recipientRole: user.role,
    });
  }

  notifyRole(role: User['role'], notif: Omit<PlatformNotification, 'id' | 'createdAt' | 'recipientId' | 'recipientRole'>) {
    return this.users
      .filter((user) => user.role === role && user.status === 'active')
      .map((user) => this.notifyUser(user.id, notif))
      .filter(Boolean);
  }

  hasPassword(userId: string): boolean {
    return this.passwords.has(userId);
  }

  checkPassword(userId: string, password: string): boolean {
    return this.passwords.get(userId) === password;
  }

  createOrganizationAccounts(input: {
    organizationName: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    deskName: string;
    deskEmail: string;
    deskPassword: string;
    phone?: string;
  }): { admin: User; desk: User } {
    const adminEmail = input.adminEmail.trim().toLowerCase();
    const deskEmail = input.deskEmail.trim().toLowerCase();
    if (adminEmail === deskEmail) {
      throw new Error('The organization admin and the triage desk need different emails.');
    }
    const taken = this.users.some((user) => {
      const email = user.email.toLowerCase();
      return email === adminEmail || email === deskEmail;
    });
    if (taken) {
      throw new Error('An account with that email already exists.');
    }

    const now = new Date().toISOString();
    const phone = input.phone?.trim() || '';
    const admin: User = {
      id: `usr-org-admin-${Date.now()}`,
      email: adminEmail,
      fullName: input.adminName.trim(),
      role: 'client',
      clientAccountType: 'organization_admin',
      phone,
      organizationName: input.organizationName.trim(),
      status: 'active',
      createdAt: now,
    };
    const desk: User = {
      id: `usr-org-desk-${Date.now()}`,
      email: deskEmail,
      fullName: input.deskName.trim(),
      role: 'client',
      clientAccountType: 'common_terminal',
      phone,
      organizationName: input.organizationName.trim(),
      status: 'active',
      createdAt: now,
    };
    this.users.push(admin, desk);
    this.passwords.set(admin.id, input.adminPassword);
    this.passwords.set(desk.id, input.deskPassword);
    return { admin, desk };
  }

  createInterpreterAccount(input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    languages: string[];
    categories: ServiceCategory[];
  }): { user: User; profile: InterpreterProfile } {
    const email = input.email.trim().toLowerCase();
    const taken = this.users.some((user) => user.email.toLowerCase() === email)
      || this.interpreters.some((person) => person.email.toLowerCase() === email);
    if (taken) {
      throw new Error('An account with that email already exists.');
    }

    const now = new Date().toISOString();
    const user: User = {
      id: `usr-interp-${Date.now()}`,
      email,
      fullName: input.fullName.trim(),
      role: 'interpreter',
      phone: input.phone?.trim() || '',
      organizationName: 'National Accredited Interpreters Registry',
      status: 'active',
      createdAt: now,
    };
    const profile: InterpreterProfile = {
      id: `int-${Date.now()}`,
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email,
      supportedLanguages: input.languages.map((languageCode) => ({
        languageCode,
        proficiency: 'professional' as const,
        pairDirection: 'bidirectional' as const,
      })),
      serviceCategories: input.categories,
      qualifications: [],
      verificationState: 'verified',
      availability: 'available',
      rating: 4.8,
      totalSessionsCompleted: 0,
    };
    this.users.push(user);
    this.interpreters.push(profile);
    this.passwords.set(user.id, input.password);
    return { user, profile };
  }

  removeAccounts(userIds: string[]) {
    const ids = new Set(userIds);
    this.users = this.users.filter((user) => !ids.has(user.id));
    this.interpreters = this.interpreters.filter((person) => !ids.has(person.userId));
    for (const id of ids) this.passwords.delete(id);
  }
}

export const db = new DatabaseStore();
