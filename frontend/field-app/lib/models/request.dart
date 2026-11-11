class InterpretationRequest {
  final String reference;
  final String requesterId;
  final String requesterName;
  final String organizationName;
  final String sourceLanguage;
  final String targetLanguage;
  final bool isUnknownLanguage;
  final String? unknownLanguageNotes;
  final String serviceCategory;
  final String urgency;
  final String modality;
  final String scheduleType;
  final String? scheduledTime;
  final String status;
  final String minRoutingContext;
  final String createdAt;
  final String? assignedInterpreterName;
  final String? activeSessionId;
  final String? escalationReason;

  InterpretationRequest({
    required this.reference,
    required this.requesterId,
    required this.requesterName,
    required this.organizationName,
    required this.sourceLanguage,
    required this.targetLanguage,
    required this.isUnknownLanguage,
    this.unknownLanguageNotes,
    required this.serviceCategory,
    required this.urgency,
    required this.modality,
    required this.scheduleType,
    this.scheduledTime,
    required this.status,
    required this.minRoutingContext,
    required this.createdAt,
    this.assignedInterpreterName,
    this.activeSessionId,
    this.escalationReason,
  });

  factory InterpretationRequest.fromJson(Map<String, dynamic> json) {
    return InterpretationRequest(
      reference: json['reference'] as String,
      requesterId: json['requesterId'] as String? ?? '',
      requesterName: json['requesterName'] as String? ?? '',
      organizationName: json['organizationName'] as String? ?? '',
      sourceLanguage: json['sourceLanguage'] as String? ?? 'amh',
      targetLanguage: json['targetLanguage'] as String? ?? 'amh',
      isUnknownLanguage: json['isUnknownLanguage'] as bool? ?? false,
      unknownLanguageNotes: json['unknownLanguageNotes'] as String?,
      serviceCategory: json['serviceCategory'] as String? ?? 'healthcare',
      urgency: json['urgency'] as String? ?? 'standard',
      modality: json['modality'] as String? ?? 'audio',
      scheduleType: json['scheduleType'] as String? ?? 'immediate',
      scheduledTime: json['scheduledTime'] as String?,
      status: json['status'] as String? ?? 'submitted',
      minRoutingContext: json['minRoutingContext'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      assignedInterpreterName: json['assignedInterpreterName'] as String?,
      activeSessionId: json['activeSessionId'] as String?,
      escalationReason: json['escalationReason'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'reference': reference,
    'sourceLanguage': sourceLanguage,
    'targetLanguage': targetLanguage,
    'isUnknownLanguage': isUnknownLanguage,
    'unknownLanguageNotes': unknownLanguageNotes,
    'serviceCategory': serviceCategory,
    'urgency': urgency,
    'modality': modality,
    'scheduleType': scheduleType,
    'scheduledTime': scheduledTime,
    'status': status,
    'minRoutingContext': minRoutingContext,
  };
}
