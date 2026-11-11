import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/language.dart';
import '../models/request.dart';
import '../models/session.dart';

class ApiService {
  static const String accountIdKey = 'orzo_account_id';
  static const String accountNameKey = 'orzo_account_name';
  static String? accountId;

  static String resolveBaseUrl() {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000/api/v1';
    }
    return 'http://127.0.0.1:8000/api/v1';
  }

  final String baseUrl;

  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? resolveBaseUrl();

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (accountId != null) 'X-Account-Id': accountId!,
  };

  static Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    accountId = prefs.getString(accountIdKey);
  }

  static Future<void> clearSession() async {
    accountId = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(accountIdKey);
    await prefs.remove(accountNameKey);
  }

  Future<String> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers,
      body: json.encode({'email': email.trim(), 'password': password}),
    );
    final data = json.decode(response.body);
    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Sign in failed');
    }
    final user = data['user'] as Map<String, dynamic>;
    accountId = user['id'] as String;
    final name = user['fullName'] as String? ?? email;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(accountIdKey, accountId!);
    await prefs.setString(accountNameKey, name);
    return name;
  }

  Future<List<SupportedLanguage>> fetchLanguages() async {
    final response = await http.get(Uri.parse('$baseUrl/languages'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['languages'] as List;
      return list.map((e) => SupportedLanguage.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load supported language catalog: ${response.statusCode}');
    }
  }

  Future<List<InterpretationRequest>> fetchClientRequests() async {
    final response = await http.get(Uri.parse('$baseUrl/requests'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['requests'] as List;
      return list.map((e) => InterpretationRequest.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load interpretation requests: ${response.statusCode}');
    }
  }

  Future<InterpretationRequest> createRequest({
    String? sourceLanguage,
    required String targetLanguage,
    bool isUnknownLanguage = false,
    String? unknownLanguageNotes,
    required String serviceCategory,
    required String urgency,
    required String modality,
    required String scheduleType,
    String? scheduledTime,
    required String minRoutingContext,
  }) async {
    final body = json.encode({
      'sourceLanguage': isUnknownLanguage ? 'unknown' : sourceLanguage,
      'targetLanguage': targetLanguage,
      'isUnknownLanguage': isUnknownLanguage,
      'unknownLanguageNotes': unknownLanguageNotes,
      'serviceCategory': serviceCategory,
      'urgency': urgency,
      'modality': modality,
      'scheduleType': scheduleType,
      'scheduledTime': scheduledTime,
      'minRoutingContext': minRoutingContext,
    });

    final response = await http.post(
      Uri.parse('$baseUrl/requests'),
      headers: _headers,
      body: body,
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      final data = json.decode(response.body);
      return InterpretationRequest.fromJson(data['request']);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['error'] ?? 'Failed to submit interpretation request');
    }
  }

  Future<void> cancelRequest(String reference, String reason) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests/$reference/cancel'),
      headers: _headers,
      body: json.encode({'reason': reason}),
    );
    if (response.statusCode != 200) {
      final err = json.decode(response.body);
      throw Exception(err['error'] ?? 'Failed to cancel request');
    }
  }

  Future<InterpretationSession> fetchSession(String sessionId) async {
    final response = await http.get(Uri.parse('$baseUrl/sessions/$sessionId'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return InterpretationSession.fromJson(data['session']);
    } else {
      throw Exception('Failed to retrieve session: ${response.statusCode}');
    }
  }

  Future<void> endSession(String sessionId) async {
    await http.post(Uri.parse('$baseUrl/sessions/$sessionId/end'), headers: _headers);
  }

  Future<void> submitFeedback(String sessionId, int rating, String? comment) async {
    await http.post(
      Uri.parse('$baseUrl/feedback'),
      headers: _headers,
      body: json.encode({
        'sessionId': sessionId,
        'rating': rating,
        'comment': comment,
      }),
    );
  }
}
