import 'package:flutter/material.dart';

class IntroScreen extends StatelessWidget {
  final VoidCallback onFinished;

  const IntroScreen({super.key, required this.onFinished});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6F7),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 8, 28, 18),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onFinished,
                  child: const Text('Skip', style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w700)),
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return SingleChildScrollView(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: constraints.maxHeight),
                        child: const Center(child: _LogoPage()),
                      ),
                    );
                  },
                ),
              ),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0E2A3A),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: onFinished,
                  child: const Text('Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LogoPage extends StatelessWidget {
  const _LogoPage();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ClipOval(
          child: Image.asset('assets/logo.png', width: 150, height: 150, fit: BoxFit.cover),
        ),
        const SizedBox(height: 24),
        const Text(
          'Bridge Language Barriers with Orzo',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF123044), height: 1.15),
        ),
        const SizedBox(height: 12),
        const Text(
          'Connect with professional interpreters for hospitals, courts, and public desks.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF475569), height: 1.4),
        ),
      ],
    );
  }
}
