import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/session.dart';

class LiveCallScreen extends StatefulWidget {
  final String sessionId;

  const LiveCallScreen({super.key, required this.sessionId});

  @override
  State<LiveCallScreen> createState() => _LiveCallScreenState();
}

class _LiveCallScreenState extends State<LiveCallScreen> {
  final ApiService _api = ApiService();
  InterpretationSession? _session;
  bool _isLoading = true;
  bool _isMuted = false;
  bool _isSpeakerOn = true;
  int _seconds = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _fetchSession();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (mounted) setState(() => _seconds++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchSession() async {
    try {
      final s = await _api.fetchSession(widget.sessionId);
      if (mounted) setState(() => _session = s);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatTime(int sec) {
    final m = (sec ~/ 60).toString().padLeft(2, '0');
    final s = (sec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _endCall() async {
    await _api.endSession(widget.sessionId);
    if (!mounted) return;
    _showFeedbackDialog();
  }

  void _showFeedbackDialog() {
    int rating = 5;
    final textController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Session Feedback (SRS FR-053)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Rate interpretation clarity & professionalism:'),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  final starVal = index + 1;
                  return IconButton(
                    icon: Icon(
                      starVal <= rating ? Icons.star : Icons.star_border,
                      color: Colors.amber,
                    ),
                    onPressed: () {
                      setDialogState(() => rating = starVal);
                    },
                  );
                }),
              ),
              TextField(
                controller: textController,
                decoration: const InputDecoration(
                  labelText: 'Comments (Optional)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('Skip'),
            ),
            FilledButton(
              onPressed: () async {
                await _api.submitFeedback(widget.sessionId, rating, textController.text);
                if (mounted) {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                }
              },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = _session != null
        ? '${_session!.sourceLanguage.toUpperCase()} ⇄ ${_session!.targetLanguage.toUpperCase()}'
        : 'Connecting...';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Dark slate
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.red[900]!.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.red[700]!),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield, size: 12, color: Colors.redAccent),
                SizedBox(width: 4),
                Text('REC OFF (SRS 7.4)', style: TextStyle(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top duration & network status
                  Column(
                    children: [
                      const SizedBox(height: 12),
                      Text(
                        _formatTime(_seconds),
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 2),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.wifi, size: 14, color: Colors.green[400]),
                          const SizedBox(width: 4),
                          Text('Ethio Telecom Low-Bandwidth (16kbps)', style: TextStyle(fontSize: 12, color: Colors.grey[400])),
                        ],
                      ),
                    ],
                  ),

                  // Center avatars
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Card(
                      color: const Color(0xFF1E293B),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          children: [
                            CircleAvatar(
                              radius: 40,
                              backgroundColor: const Color(0xFF046A38),
                              child: const Icon(Icons.person, size: 48, color: Colors.white),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _session?.interpreterName ?? 'Certified Interpreter',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Accredited Clinical & Judicial Corps',
                              style: TextStyle(fontSize: 12, color: Colors.amber[300]),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black26,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.volume_up, size: 16, color: Colors.greenAccent),
                                  SizedBox(width: 6),
                                  Text('Active Two-Way Audio', style: TextStyle(color: Colors.greenAccent, fontSize: 12)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Bottom call controls
                  Padding(
                    padding: const EdgeInsets.only(bottom: 32.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        // Mute button
                        IconButton.filledTonal(
                          iconSize: 28,
                          onPressed: () => setState(() => _isMuted = !_isMuted),
                          icon: Icon(_isMuted ? Icons.mic_off : Icons.mic),
                        ),
                        // End call button
                        IconButton.filled(
                          iconSize: 32,
                          style: IconButton.styleFrom(backgroundColor: Colors.red[600]),
                          onPressed: _endCall,
                          icon: const Icon(Icons.call_end, color: Colors.white),
                        ),
                        // Speakerphone button
                        IconButton.filledTonal(
                          iconSize: 28,
                          onPressed: () => setState(() => _isSpeakerOn = !_isSpeakerOn),
                          icon: Icon(_isSpeakerOn ? Icons.volume_up : Icons.phone_android),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
