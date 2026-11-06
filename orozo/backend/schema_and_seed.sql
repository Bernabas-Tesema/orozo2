-- ============================================================================
-- ORZO Ethiopian Language Interpretation Platform
-- PostgreSQL Database Schema & Seed Data Script
-- Database: orzo_db
-- User: postgres (Bern@2026)
-- Host: localhost:5432
-- ============================================================================

-- Create uuid extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Table: api_account
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_account (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(254) UNIQUE NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    role VARCHAR(32) NOT NULL,
    client_account_type VARCHAR(32) DEFAULT '',
    phone VARCHAR(40) DEFAULT '',
    organization_name VARCHAR(200) NOT NULL,
    status VARCHAR(32) DEFAULT 'active',
    password_hash VARCHAR(256) DEFAULT ''
);

-- ----------------------------------------------------------------------------
-- 2. Table: api_language
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_language (
    code VARCHAR(8) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    native_name VARCHAR(80) NOT NULL,
    script VARCHAR(16) NOT NULL,
    variants JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- 3. Table: api_interpreter
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_interpreter (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) DEFAULT '',
    email VARCHAR(254) NOT NULL,
    languages JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    availability VARCHAR(16) DEFAULT 'available',
    verification_state VARCHAR(16) DEFAULT 'verified',
    rating DOUBLE PRECISION DEFAULT 4.8
);

-- ----------------------------------------------------------------------------
-- 4. Table: api_interpretationrequest
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_interpretationrequest (
    reference VARCHAR(32) PRIMARY KEY,
    requester_id VARCHAR(64) NOT NULL,
    requester_name VARCHAR(160) NOT NULL,
    requester_phone VARCHAR(40) DEFAULT '',
    organization_name VARCHAR(200) NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    target_language VARCHAR(16) NOT NULL,
    is_unknown_language BOOLEAN DEFAULT FALSE,
    unknown_language_notes TEXT DEFAULT '',
    service_category VARCHAR(32) NOT NULL,
    urgency VARCHAR(16) DEFAULT 'standard',
    modality VARCHAR(24) DEFAULT 'audio',
    schedule_type VARCHAR(16) DEFAULT 'immediate',
    scheduled_time VARCHAR(40),
    status VARCHAR(32) DEFAULT 'submitted',
    min_routing_context TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_interpreter_id VARCHAR(64),
    assigned_interpreter_name VARCHAR(160),
    active_session_id VARCHAR(32),
    cancellation_reason TEXT,
    escalation_reason TEXT
);

-- ----------------------------------------------------------------------------
-- 5. Table: api_interpretationsession
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_interpretationsession (
    id VARCHAR(32) PRIMARY KEY,
    request_reference VARCHAR(32) NOT NULL,
    session_token VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'ready_to_join',
    communication_mode VARCHAR(24) DEFAULT 'audio',
    low_bandwidth_mode BOOLEAN DEFAULT TRUE,
    recording_enabled BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER DEFAULT 0,
    interpreter_name VARCHAR(160) DEFAULT '',
    client_name VARCHAR(160) NOT NULL,
    organization_name VARCHAR(200) NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    target_language VARCHAR(16) NOT NULL,
    service_category VARCHAR(32) NOT NULL,
    connection_health VARCHAR(16) DEFAULT 'optimal'
);

-- ----------------------------------------------------------------------------
-- 6. Table: api_sessionfeedback
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_sessionfeedback (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(32) NOT NULL,
    rating SMALLINT NOT NULL,
    comment TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Table: communications_interpretationsession
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications_interpretationsession (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_reference VARCHAR(64) UNIQUE NOT NULL,
    request_reference VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) DEFAULT '',
    customer_name VARCHAR(160) DEFAULT '',
    interpreter_id VARCHAR(64),
    interpreter_name VARCHAR(160) DEFAULT '',
    room_name VARCHAR(128) UNIQUE NOT NULL,
    communication_type VARCHAR(24) DEFAULT 'audio',
    status VARCHAR(32) DEFAULT 'ready',
    source_language VARCHAR(16) DEFAULT '',
    target_language VARCHAR(16) DEFAULT '',
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    cancellation_reason TEXT,
    completion_notes TEXT,
    created_by VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id_fk VARCHAR(64) REFERENCES api_account(id) ON DELETE SET NULL,
    interpreter_id_fk VARCHAR(64) REFERENCES api_account(id) ON DELETE SET NULL,
    request_id VARCHAR(32) REFERENCES api_interpretationrequest(reference) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS comm_req_status_idx ON communications_interpretationsession (request_reference, status);
CREATE INDEX IF NOT EXISTS comm_cust_status_idx ON communications_interpretationsession (customer_id, status);
CREATE INDEX IF NOT EXISTS comm_int_status_idx ON communications_interpretationsession (interpreter_id, status);
CREATE INDEX IF NOT EXISTS comm_lang_pair_idx ON communications_interpretationsession (source_language, target_language);
CREATE INDEX IF NOT EXISTS comm_status_created_idx ON communications_interpretationsession (status, created_at);
CREATE INDEX IF NOT EXISTS comm_sched_time_idx ON communications_interpretationsession (scheduled_start_time);
CREATE INDEX IF NOT EXISTS comm_created_idx ON communications_interpretationsession (created_at);

-- ----------------------------------------------------------------------------
-- 8. Table: communications_sessionparticipant
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications_sessionparticipant (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES communications_interpretationsession(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(160) NOT NULL,
    role VARCHAR(32) NOT NULL,
    connection_status VARCHAR(32) DEFAULT 'authorized',
    join_timestamp TIMESTAMP WITH TIME ZONE,
    leave_timestamp TIMESTAMP WITH TIME ZONE,
    activity_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id_fk VARCHAR(64) REFERENCES api_account(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS part_session_user_idx ON communications_sessionparticipant (session_id, user_id);
CREATE INDEX IF NOT EXISTS part_user_role_idx ON communications_sessionparticipant (user_id, role);

-- ----------------------------------------------------------------------------
-- 9. Table: communications_sessionevent
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications_sessionevent (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES communications_interpretationsession(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    description VARCHAR(255) DEFAULT '',
    actor_id VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    actor_id_fk VARCHAR(64) REFERENCES api_account(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS event_session_time_idx ON communications_sessionevent (session_id, timestamp);
CREATE INDEX IF NOT EXISTS event_type_time_idx ON communications_sessionevent (event_type, timestamp);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Languages
INSERT INTO api_language (code, name, native_name, script, variants, is_active)
VALUES
    ('amh', 'Amharic', 'አማርኛ', 'Ethiopic', '["Gondar", "Wollo", "Shewa", "Gojjam"]'::jsonb, TRUE),
    ('orm', 'Afaan Oromoo', 'Afaan Oromoo', 'Latin', '["Central (Shewa)", "Western (Wollega)", "Eastern (Harar)"]'::jsonb, TRUE),
    ('tir', 'Tigrinya', 'ትግርኛ', 'Ethiopic', '["Enderta", "Adwa", "Agame"]'::jsonb, TRUE),
    ('som', 'Somali', 'Af-Soomaali', 'Latin', '["Ogaden", "Jijiga", "Shinile"]'::jsonb, TRUE),
    ('sid', 'Sidama', 'Sidaamu Afoo', 'Latin', '["Hawassa", "Aleta Wondo"]'::jsonb, TRUE),
    ('wal', 'Wolaytta', 'Wolayttatto Doonaa', 'Latin', '["Soddo", "Areka"]'::jsonb, TRUE),
    ('gur', 'Gurage', 'ጉራጊኛ', 'Ethiopic', '["Sebat Bet", "Silt''e"]'::jsonb, TRUE),
    ('aar', 'Afar', 'Qafaraf', 'Latin', '["Northern", "Central"]'::jsonb, TRUE),
    ('eng', 'English', 'English', 'Latin', '["International"]'::jsonb, TRUE),
    ('ara', 'Arabic', 'العربية', 'Arabic', '["Modern Standard", "Yemeni / Red Sea"]'::jsonb, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Accounts
INSERT INTO api_account (id, email, full_name, role, client_account_type, phone, organization_name, status, password_hash)
VALUES
    ('usr-client-common-1', 'triage.desk@tikuranbessa.gov.et', 'Emergency Triage Desk #1', 'client', 'common_terminal', '+251 91 123 4599', 'Tikur Anbessa Specialized Hospital', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('usr-client-admin-1', 'admin.bekele@tikuranbessa.gov.et', 'Dr. Solomon Bekele', 'client', 'organization_admin', '+251 91 123 4567', 'Tikur Anbessa Specialized Hospital', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('usr-client-admin-2', 'admin.tadesse@moj.gov.et', 'Meron Tadesse', 'client', 'organization_admin', '+251 92 234 5678', 'Federal First Instance Court (Arada Bench)', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('usr-client-common-2', 'registry.desk@moj.gov.et', 'Bench Room 3 Registry', 'client', 'common_terminal', '+251 92 234 5699', 'Federal First Instance Court (Arada Bench)', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('usr-admin-1', 'admin.dawit@elip.et', 'Dawit Mengistu', 'platform_admin', '', '+251 91 888 9999', 'Ministry of Innovation & Technology / ELIP Operations', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('int-1', 'chaltu.kebede@interpreters.et', 'Chaltu Kebede', 'interpreter', '', '+251 91 555 0101', 'Independent Certified Interpreter', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo'),
    ('int-2', 'berhane.gebre@interpreters.et', 'Berhane Gebremariam', 'interpreter', '', '+251 91 555 0202', 'Independent Certified Interpreter', 'active', 'pbkdf2_sha256$720000$orzo$8k+demo')
ON CONFLICT (id) DO NOTHING;

-- Interpreters
INSERT INTO api_interpreter (id, full_name, phone, email, languages, categories, availability, verification_state, rating)
VALUES
    ('int-1', 'Chaltu Kebede', '+251 91 555 0101', 'chaltu.kebede@interpreters.et', '["orm", "amh", "eng"]'::jsonb, '["healthcare", "public_services", "ngo_humanitarian", "education"]'::jsonb, 'busy', 'verified', 4.9),
    ('int-2', 'Berhane Gebremariam', '+251 91 555 0202', 'berhane.gebre@interpreters.et', '["tir", "amh", "eng"]'::jsonb, '["legal_court", "immigration", "healthcare", "public_services"]'::jsonb, 'available', 4.95),
    ('int-3', 'Faduma Omar Hassan', '+251 91 555 0303', 'faduma.omar@interpreters.et', '["som", "amh", "ara", "eng"]'::jsonb, '["healthcare", "immigration", "ngo_humanitarian", "business"]'::jsonb, 'available', 4.88),
    ('int-4', 'Tariku Wonche', '+251 91 555 0404', 'tariku.wonche@interpreters.et', '["sid", "wal", "amh"]'::jsonb, '["healthcare", "public_services", "education"]'::jsonb, 'available', 4.82)
ON CONFLICT (id) DO NOTHING;

-- Interpretation Request
INSERT INTO api_interpretationrequest (
    reference, requester_id, requester_name, requester_phone, organization_name,
    source_language, target_language, is_unknown_language, unknown_language_notes,
    service_category, urgency, modality, schedule_type, scheduled_time, status,
    min_routing_context, created_at, updated_at, assigned_interpreter_id,
    assigned_interpreter_name, active_session_id
) VALUES (
    'REQ-2026-10821', 'usr-client-common-1', 'Emergency Triage Desk #1', '+251 91 123 4599',
    'Tikur Anbessa Specialized Hospital', 'orm', 'amh', FALSE, '', 'healthcare', 'emergency',
    'video', 'immediate', NULL, 'in_session',
    'Emergency pediatric triage: acute respiratory distress, primary speech Afaan Oromoo only.',
    NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 minutes',
    'int-1', 'Chaltu Kebede', 'SES-2026-10821'
) ON CONFLICT (reference) DO NOTHING;

-- API Interpretation Session
INSERT INTO api_interpretationsession (
    id, request_reference, session_token, status, communication_mode,
    low_bandwidth_mode, recording_enabled, duration_seconds, interpreter_name,
    client_name, organization_name, source_language, target_language,
    service_category, connection_health
) VALUES (
    'SES-9921', 'REQ-2026-10821', 'SES-TOKEN-e89a24cf', 'active', 'video',
    TRUE, FALSE, 840, 'Chaltu Kebede', 'Emergency Triage Desk #1',
    'Tikur Anbessa Specialized Hospital', 'orm', 'amh', 'healthcare', 'optimal'
) ON CONFLICT (id) DO NOTHING;

-- PostgreSQL Communications Interpretation Session
INSERT INTO communications_interpretationsession (
    id, session_reference, request_reference, customer_id, customer_name,
    interpreter_id, interpreter_name, room_name, communication_type, status,
    source_language, target_language, actual_start_time, actual_end_time,
    duration_seconds, completion_notes, created_by, created_at, updated_at
) VALUES (
    'b386d68d-673d-41d0-944f-d672f8a19381'::uuid,
    'SES-2026-10821', 'REQ-2026-10821', 'usr-client-common-1', 'Emergency Triage Desk #1',
    'int-1', 'Chaltu Kebede', 'rm_orzo_triage_bay2', 'video', 'completed',
    'orm', 'amh', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '11 minutes',
    840, 'Emergency pediatric triage completed: patient admitted to Bay 2 with Afaan Oromoo medical interpreter present.',
    'usr-client-common-1', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '11 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Session Participants
INSERT INTO communications_sessionparticipant (
    session_id, user_id, user_name, role, connection_status,
    join_timestamp, leave_timestamp, activity_info, created_at
) VALUES
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'usr-client-common-1', 'Emergency Triage Desk #1', 'customer', 'left', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '11 minutes', '{"device": "hospital_terminal"}'::jsonb, NOW() - INTERVAL '25 minutes'),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'int-1', 'Chaltu Kebede', 'interpreter', 'left', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '11 minutes', '{"device": "flutter_mobile"}'::jsonb, NOW() - INTERVAL '25 minutes')
ON CONFLICT DO NOTHING;

-- Session Events (Append-Only Audit Trail)
INSERT INTO communications_sessionevent (
    session_id, event_type, description, actor_id, timestamp, metadata
) VALUES
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'session_created', 'Interpretation session SES-2026-10821 created for REQ-2026-10821.', 'usr-client-common-1', NOW() - INTERVAL '30 minutes', '{"mode": "video", "source": "orm", "target": "amh"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'interpreter_assigned', 'Interpreter Chaltu Kebede assigned to session.', 'int-1', NOW() - INTERVAL '28 minutes', '{"interpreterId": "int-1"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'room_created', 'LiveKit room rm_orzo_triage_bay2 allocated.', 'system', NOW() - INTERVAL '27 minutes', '{"room": "rm_orzo_triage_bay2"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'customer_joined', 'Emergency Triage Desk #1 joined session.', 'usr-client-common-1', NOW() - INTERVAL '25 minutes', '{"device": "hospital_terminal"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'interpreter_joined', 'Chaltu Kebede joined session.', 'int-1', NOW() - INTERVAL '25 minutes', '{"device": "flutter_mobile"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'call_started', 'Live call active on LiveKit room rm_orzo_triage_bay2.', 'system', NOW() - INTERVAL '25 minutes', '{"actualStartTime": "2026-11-06T09:35:00Z"}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'session_completed', 'Session completed. Duration: 840s.', 'usr-client-common-1', NOW() - INTERVAL '11 minutes', '{"durationSeconds": 840}'::jsonb),
    ('b386d68d-673d-41d0-944f-d672f8a19381'::uuid, 'room_closed', 'LiveKit room rm_orzo_triage_bay2 closed.', 'system', NOW() - INTERVAL '11 minutes', '{"room": "rm_orzo_triage_bay2"}'::jsonb)
ON CONFLICT DO NOTHING;
