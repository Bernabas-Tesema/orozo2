import 'package:flutter/material.dart';
import '../data/categories.dart';
import '../services/api_service.dart';
import '../models/language.dart';
import 'live_call_screen.dart';

class IntakeScreen extends StatefulWidget {
  final String initialCategory;

  const IntakeScreen({super.key, this.initialCategory = 'healthcare'});

  @override
  State<IntakeScreen> createState() => _IntakeScreenState();
}

class _IntakeScreenState extends State<IntakeScreen> {
  final ApiService _api = ApiService();
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = false;
  List<SupportedLanguage> _languages = [];
  String _sourceLanguage = 'orm'; // Afaan Oromoo
  String _targetLanguage = 'amh'; // Amharic
  bool _isUnknownLanguage = false;
  final TextEditingController _unknownNotesController = TextEditingController();
  final TextEditingController _contextController = TextEditingController();

  late String _serviceCategory;
  String _urgency = 'emergency';
  String _modality = 'audio';
  String _scheduleType = 'immediate';

  @override
  void initState() {
    super.initState();
    _serviceCategory = widget.initialCategory;
    _loadLanguages();
  }

  Future<void> _loadLanguages() async {
    try {
      final langs = await _api.fetchLanguages();
      setState(() {
        _languages = langs.where((l) => l.isActive).toList();
      });
    } catch (_) {
      // Default fallback list
      setState(() {
        _languages = [
          SupportedLanguage(code: 'amh', name: 'Amharic', nativeName: 'አማርኛ', script: 'Ethiopic', variants: [], isActive: true),
          SupportedLanguage(code: 'orm', name: 'Afaan Oromoo', nativeName: 'Afaan Oromoo', script: 'Latin', variants: [], isActive: true),
          SupportedLanguage(code: 'tir', name: 'Tigrinya', nativeName: 'ትግርኛ', script: 'Ethiopic', variants: [], isActive: true),
          SupportedLanguage(code: 'som', name: 'Somali', nativeName: 'Af-Soomaali', script: 'Latin', variants: [], isActive: true),
          SupportedLanguage(code: 'sid', name: 'Sidama', nativeName: 'Sidaamu Afoo', script: 'Latin', variants: [], isActive: true),
          SupportedLanguage(code: 'wal', name: 'Wolaytta', nativeName: 'Wolayttatto', script: 'Latin', variants: [], isActive: true),
        ];
      });
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final req = await _api.createRequest(
        sourceLanguage: _isUnknownLanguage ? null : _sourceLanguage,
        targetLanguage: _targetLanguage,
        isUnknownLanguage: _isUnknownLanguage,
        unknownLanguageNotes: _isUnknownLanguage ? _unknownNotesController.text : null,
        serviceCategory: _serviceCategory,
        urgency: _urgency,
        modality: _modality,
        scheduleType: _scheduleType,
        minRoutingContext: _contextController.text.trim(),
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Request created: ${req.reference} (${req.status})'),
          backgroundColor: const Color(0xFF046A38),
        ),
      );

      if (req.activeSessionId != null) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => LiveCallScreen(sessionId: req.activeSessionId!),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          backgroundColor: Colors.red[800],
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ORZO • Client Intake', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text('Institutional Interpretation Dispatch', style: TextStyle(fontSize: 11, color: Colors.white70)),
          ],
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            // Urgency Banner & Selector
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: _urgency == 'emergency' ? Colors.red[400]! : Colors.grey[300]!),
              ),
              color: _urgency == 'emergency' ? Colors.red[50] : Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'URGENCY TIER (SRS 7.2)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 1),
                    ),
                    const SizedBox(height: 8),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'emergency', label: Text('Emergency'), icon: Icon(Icons.warning, size: 16)),
                        ButtonSegment(value: 'high', label: Text('High')),
                        ButtonSegment(value: 'standard', label: Text('Standard')),
                      ],
                      selected: {_urgency},
                      onSelectionChanged: (val) {
                        setState(() => _urgency = val.first);
                      },
                    ),
                    if (_urgency == 'emergency')
                      const Padding(
                        padding: EdgeInsets.only(top: 8.0),
                        child: Text(
                          'Safety Mandate: Urgent medical or legal care must not be delayed while searching for an interpreter.',
                          style: TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Sector Selection
            const Text(
              'SERVICE CATEGORY',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 1),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 108,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: orzoCategories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final category = orzoCategories[index];
                  final selected = category.id == _serviceCategory;
                  return GestureDetector(
                    onTap: () => setState(() => _serviceCategory = category.id),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: 132,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selected ? const Color(0xFF046A38) : Colors.grey.shade300,
                          width: selected ? 2.5 : 1,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.asset(category.asset, fit: BoxFit.cover),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.transparent,
                                  Colors.black.withValues(alpha: 0.72),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Align(
                              alignment: Alignment.bottomLeft,
                              child: Text(
                                category.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // Unknown Language Checkbox (SRS FR-016 & FR-017)
            Container(
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber[300]!),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Unknown or Uncertain Language/Dialect',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      subtitle: const Text(
                        'Automatically escalates to human coordinator. Prohibits AI guesswork.',
                        style: TextStyle(fontSize: 11),
                      ),
                      value: _isUnknownLanguage,
                      onChanged: (val) => setState(() => _isUnknownLanguage = val ?? false),
                    ),
                    if (_isUnknownLanguage)
                      Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: TextFormField(
                          controller: _unknownNotesController,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            labelText: 'Dialect Clues / Region of Origin',
                            hintText: 'e.g., Patient from Moyale border, speaks dialect with Oromo words',
                            border: OutlineInputBorder(),
                            fillColor: Colors.white,
                            filled: true,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            if (!_isUnknownLanguage && _languages.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: LinearProgressIndicator(),
              ),
            if (!_isUnknownLanguage && _languages.isNotEmpty) ...[
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Patient/Client Language (Source)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.translate),
                ),
                initialValue: _sourceLanguage,
                items: _languages.map((l) {
                  return DropdownMenuItem(
                    value: l.code,
                    child: Text('${l.name} (${l.nativeName})'),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _sourceLanguage = val);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Staff/Institutional Language (Target)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.language),
                ),
                initialValue: _targetLanguage,
                items: _languages.map((l) {
                  return DropdownMenuItem(
                    value: l.code,
                    child: Text('${l.name} (${l.nativeName})'),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _targetLanguage = val);
                },
              ),
              const SizedBox(height: 16),
            ],

            // Modality / Staff-assisted Speakerphone (SRS 8.6)
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'audio', label: Text('Audio Call'), icon: Icon(Icons.phone)),
                ButtonSegment(value: 'video', label: Text('Video Call'), icon: Icon(Icons.videocam)),
                ButtonSegment(value: 'phone_assisted', label: Text('Speakerphone'), icon: Icon(Icons.volume_up)),
              ],
              selected: {_modality},
              onSelectionChanged: (val) => setState(() => _modality = val.first),
            ),
            if (_modality == 'phone_assisted')
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  'Staff-assisted speakerphone: Organization phone provides audio access for patients without smartphones.',
                  style: TextStyle(fontSize: 11, color: Colors.blueGrey),
                ),
              ),
            const SizedBox(height: 16),

            // Minimum Routing Context (SRS FR-021 & FR-027)
            TextFormField(
              controller: _contextController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Minimum Routing Context',
                hintText: 'e.g. Acute pediatric triage consultation (Avoid full IDs per FR-027)',
                border: OutlineInputBorder(),
                helperText: 'SRS FR-027: Do not collect full medical histories or national IDs.',
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) {
                  return 'Please enter a brief routing reason';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            // Submit Button
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF046A38),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _isLoading ? null : _submitRequest,
              icon: _isLoading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.send),
              label: Text(
                _isLoading ? 'Dispatching...' : 'Submit Interpretation Request',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
