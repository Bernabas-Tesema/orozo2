class InterpretationSession {
  final String id;
  final String requestReference;
  final String sessionToken;
  final String status;
  final String communicationMode;
  final bool lowBandwidthMode;
  final bool recordingEnabled;
  final int durationSeconds;
  final String? interpreterName;
  final String clientName;
  final String organizationName;
  final String sourceLanguage;
  final String targetLanguage;
  final String serviceCategory;
  final String connectionHealth;

  InterpretationSession({
    required this.id,
    required this.requestReference,
    required this.sessionToken,
    required this.status,
    required this.communicationMode,
    required this.lowBandwidthMode,
    required this.recordingEnabled,
    required this.durationSeconds,
    this.interpreterName,
    required this.clientName,
    required this.organizationName,
    required this.sourceLanguage,
    required this.targetLanguage,
    required this.serviceCategory,
    required this.connectionHealth,
  });

  factory InterpretationSession.fromJson(Map<String, dynamic> json) {
    return InterpretationSession(
      id: json['id'] as String,
      requestReference: json['requestReference'] as String? ?? '',
      sessionToken: json['sessionToken'] as String? ?? '',
      status: json['status'] as String? ?? 'created',
      communicationMode: json['communicationMode'] as String? ?? 'audio',
      lowBandwidthMode: json['lowBandwidthMode'] as bool? ?? true,
      recordingEnabled: json['recordingEnabled'] as bool? ?? false,
      durationSeconds: json['durationSeconds'] as int? ?? 0,
      interpreterName: json['interpreterName'] as String?,
      clientName: json['clientName'] as String? ?? '',
      organizationName: json['organizationName'] as String? ?? '',
      sourceLanguage: json['sourceLanguage'] as String? ?? 'amh',
      targetLanguage: json['targetLanguage'] as String? ?? 'amh',
      serviceCategory: json['serviceCategory'] as String? ?? 'healthcare',
      connectionHealth: json['connectionHealth'] as String? ?? 'optimal',
    );
  }
}
