import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onSignedIn;

  const LoginScreen({super.key, required this.onSignedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _email = TextEditingController(text: 'triage.desk@tikuranbessa.gov.et');
  final TextEditingController _password = TextEditingController(text: 'orzo');
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  bool _busy = false;
  bool _signUp = false;
  String? _error;

  static const _accounts = [
    ('Triage desk', 'triage.desk@tikuranbessa.gov.et'),
    ('Hospital admin', 'admin.bekele@tikuranbessa.gov.et'),
    ('Court admin', 'admin.tadesse@moj.gov.et'),
  ];

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _api.login(_email.text, _password.text);
      if (!mounted) return;
      widget.onSignedIn();
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      setState(() => _error = message.contains('Invalid credentials')
          ? 'Invalid email or password.'
          : 'Could not reach the ORZO API. Start orozo/backend, then try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _socialNotice() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sign in with your staff email.')),
    );
  }

  void _signUpNotice() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('A platform admin registers the organization. The email and password are sent to that address.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F8),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: ColoredBox(
            color: Colors.white,
            child: _signUp ? _signUpBody() : _loginBody(),
          ),
        ),
      ),
    );
  }

  Widget _loginBody() {
    return Column(
      children: [
        const _WaveHeader(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(32, 36, 32, 12),
            children: [
              _underlineField(
                controller: _email,
                hint: 'Email',
                icon: Icons.mail_outline,
                keyboard: TextInputType.emailAddress,
              ),
              const SizedBox(height: 18),
              _underlineField(
                controller: _password,
                hint: 'Password',
                icon: Icons.lock_outline,
                obscure: true,
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Passwords are issued by your organization desk.')),
                    );
                  },
                  child: const Text(
                    'Forgot Password',
                    style: TextStyle(color: Color(0xFF9AA3B2), fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13)),
                ),
              const SizedBox(height: 8),
              Center(
                child: SizedBox(
                  width: 210,
                  height: 48,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF2F6BFF),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                    ),
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Signing in...' : 'Login', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'Login Via',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF8B95A5), fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SocialButton(color: const Color(0xFF1877F2), label: 'f', onTap: _socialNotice),
                  const SizedBox(width: 16),
                  _SocialButton(color: const Color(0xFFDB4437), label: 'G+', onTap: _socialNotice),
                  const SizedBox(width: 16),
                  _SocialButton(color: const Color(0xFF9AA0A6), icon: Icons.apple, onTap: _socialNotice),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                children: [
                  for (final account in _accounts)
                    TextButton(
                      onPressed: () => setState(() => _email.text = account.$2),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF8B95A5),
                        visualDensity: VisualDensity.compact,
                      ),
                      child: Text(account.$1, style: const TextStyle(fontSize: 12)),
                    ),
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 22),
          child: TextButton(
            onPressed: () => setState(() {
              _signUp = true;
              _error = null;
            }),
            child: const Text.rich(
              TextSpan(
                text: "Don't have an account? ",
                style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                children: [
                  TextSpan(
                    text: 'Sign Up',
                    style: TextStyle(color: Color(0xFF2F6BFF), fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _signUpBody() {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(32, 48, 32, 24),
        children: [
          const Text(
            'Sign Up',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Color(0xFF1F2937)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Create your account by filling\nup the form',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF9AA3B2), height: 1.4),
          ),
          const SizedBox(height: 36),
          _underlineField(controller: _name, hint: 'Full name', icon: Icons.person_outline),
          const SizedBox(height: 18),
          _underlineField(controller: _phone, hint: 'Phone No.', icon: Icons.phone_outlined, keyboard: TextInputType.phone),
          const SizedBox(height: 18),
          _underlineField(controller: _email, hint: 'Email', icon: Icons.mail_outline, keyboard: TextInputType.emailAddress),
          const SizedBox(height: 36),
          Center(
            child: SizedBox(
              width: 210,
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2F6BFF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                ),
                onPressed: _signUpNotice,
                child: const Text('Sign Up', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
          const SizedBox(height: 36),
          const Text(
            'Sign Up with',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF8B95A5), fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _SocialButton(color: const Color(0xFF1877F2), label: 'f', onTap: _socialNotice),
              const SizedBox(width: 16),
              _SocialButton(color: const Color(0xFFDB4437), label: 'G+', onTap: _socialNotice),
            ],
          ),
          const SizedBox(height: 28),
          TextButton(
            onPressed: () => setState(() => _signUp = false),
            child: const Text.rich(
              TextSpan(
                text: 'Already have an account? ',
                style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                children: [
                  TextSpan(
                    text: 'Login',
                    style: TextStyle(color: Color(0xFF2F6BFF), fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _underlineField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    TextInputType? keyboard,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      style: const TextStyle(fontSize: 15),
      decoration: InputDecoration(
        prefixIcon: Icon(icon, color: const Color(0xFF9AA8BA), size: 22),
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFC5CDD8)),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFE6EBF2))),
        focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF2F6BFF))),
      ),
    );
  }
}

class _WaveHeader extends StatelessWidget {
  const _WaveHeader();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 250,
      width: double.infinity,
      child: CustomPaint(
        painter: const _WelcomeWavePainter(),
        child: const SafeArea(
          child: Align(
            alignment: Alignment(0, -0.25),
            child: Text(
              'Welcome',
              style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ),
    );
  }
}

class _WelcomeWavePainter extends CustomPainter {
  const _WelcomeWavePainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.clipRect(Offset.zero & size);
    final w = size.width;
    final h = size.height;

    final blue = Path()
      ..moveTo(0, 0)
      ..lineTo(0, h * 0.58)
      ..cubicTo(w * 0.16, h * 0.58, w * 0.30, h * 0.98, w * 0.52, h * 0.80)
      ..cubicTo(w * 0.72, h * 0.64, w * 0.80, h * 0.92, w, h * 0.70)
      ..lineTo(w, 0)
      ..close();
    canvas.drawPath(blue, Paint()..color = const Color(0xFF2A62F6));

    final ribbon = Path()
      ..moveTo(w * 0.38, h * 0.88)
      ..cubicTo(w * 0.58, h * 0.66, w * 0.74, h * 1.05, w * 1.05, h * 0.68);
    canvas.drawPath(
      ribbon,
      Paint()
        ..color = const Color(0xFF1BB5B3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = h * 0.14
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _SocialButton extends StatelessWidget {
  final Color color;
  final String? label;
  final IconData? icon;
  final VoidCallback onTap;

  const _SocialButton({required this.color, required this.onTap, this.label, this.icon});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: icon != null
                ? Icon(icon, color: Colors.white, size: 22)
                : Text(
                    label ?? '',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                  ),
          ),
        ),
      ),
    );
  }
}

Future<String?> savedAccountName() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(ApiService.accountNameKey);
}
