import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/history_screen.dart';
import 'screens/intake_screen.dart';
import 'screens/intro_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';

const _introSeenKey = 'orzo_intro_seen';

void main() {
  runApp(const OrzoClientApp());
}

class OrzoClientApp extends StatelessWidget {
  const OrzoClientApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ORZO Client',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF046A38),
          primary: const Color(0xFF046A38),
          secondary: const Color(0xFFFCDD09),
          tertiary: const Color(0xFFDA121A),
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF046A38),
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
        ),
      ),
      home: const AppGate(),
    );
  }
}

class AppGate extends StatefulWidget {
  const AppGate({super.key});

  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> {
  bool _loading = true;
  bool _showIntro = true;
  bool _signedIn = false;
  String _category = 'healthcare';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    await ApiService.restoreSession();
    final seen = prefs.getBool(_introSeenKey) ?? false;
    if (!mounted) return;
    setState(() {
      _showIntro = !seen;
      _signedIn = ApiService.accountId != null;
      _loading = false;
    });
  }

  Future<void> _finishIntro() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_introSeenKey, true);
    if (!mounted) return;
    setState(() => _showIntro = false);
  }

  Future<void> _replayIntro() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_introSeenKey, false);
    if (!mounted) return;
    setState(() => _showIntro = true);
  }

  Future<void> _signOut() async {
    await ApiService.clearSession();
    if (!mounted) return;
    setState(() => _signedIn = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF10261C),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFFCDD09))),
      );
    }
    if (_showIntro) {
      return IntroScreen(onFinished: _finishIntro);
    }
    if (!_signedIn) {
      return LoginScreen(onSignedIn: () => setState(() => _signedIn = true));
    }
    return MainNavigationScreen(
      initialCategory: _category,
      onReplayIntro: _replayIntro,
      onSignOut: _signOut,
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  final String initialCategory;
  final VoidCallback onReplayIntro;
  final VoidCallback onSignOut;

  const MainNavigationScreen({
    super.key,
    required this.initialCategory,
    required this.onReplayIntro,
    required this.onSignOut,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      IntakeScreen(initialCategory: widget.initialCategory),
      const HistoryScreen(),
    ];

    return Scaffold(
      body: screens[_currentIndex],
      floatingActionButton: _currentIndex == 0
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FloatingActionButton.small(
                  heroTag: 'intro',
                  backgroundColor: const Color(0xFF10261C),
                  tooltip: 'Replay intro',
                  onPressed: widget.onReplayIntro,
                  child: const Icon(Icons.play_circle_outline, color: Color(0xFFFCDD09)),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'signout',
                  backgroundColor: const Color(0xFF0E2A3A),
                  tooltip: 'Sign out',
                  onPressed: widget.onSignOut,
                  child: const Icon(Icons.logout, color: Colors.white),
                ),
              ],
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle, color: Color(0xFF046A38)),
            label: 'New Request',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history, color: Color(0xFF046A38)),
            label: 'Requests & Status',
          ),
        ],
      ),
    );
  }
}
