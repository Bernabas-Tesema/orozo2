class SupportedLanguage {
  final String code;
  final String name;
  final String nativeName;
  final String script;
  final List<String> variants;
  final bool isActive;

  SupportedLanguage({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.script,
    required this.variants,
    required this.isActive,
  });

  factory SupportedLanguage.fromJson(Map<String, dynamic> json) {
    return SupportedLanguage(
      code: json['code'] as String,
      name: json['name'] as String,
      nativeName: json['nativeName'] as String? ?? json['name'] as String,
      script: json['script'] as String? ?? 'Latin',
      variants: (json['variants'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'code': code,
    'name': name,
    'nativeName': nativeName,
    'script': script,
    'variants': variants,
    'isActive': isActive,
  };
}
