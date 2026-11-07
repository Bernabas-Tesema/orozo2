import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/request.dart';
import 'live_call_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final ApiService _api = ApiService();
  bool _isLoading = true;
  List<InterpretationRequest> _requests = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _isLoading = true);
    try {
      final list = await _api.fetchClientRequests();
      setState(() {
        _requests = list;
      });
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'in_session':
        return Colors.green[700]!;
      case 'assigned':
        return Colors.blue[700]!;
      case 'matching':
        return Colors.amber[800]!;
      case 'pending_coordinator':
        return Colors.purple[700]!;
      case 'completed':
        return Colors.grey[700]!;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Organization Requests', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _requests.isEmpty
              ? const Center(
                  child: Text('No requests yet. Tap "New Request" to dispatch.'),
                )
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _requests.length,
                    itemBuilder: (context, index) {
                      final req = _requests[index];
                      final statusColor = _getStatusColor(req.status);

                      return Card(
                        elevation: 1,
                        margin: const EdgeInsets.symmetric(vertical: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey[200]!),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    req.reference,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                                    ),
                                    child: Text(
                                      req.status.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: statusColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${req.sourceLanguage.toUpperCase()} ➔ ${req.targetLanguage.toUpperCase()} (${req.serviceCategory.replaceAll('_', ' ')})',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                req.minRoutingContext,
                                style: TextStyle(color: Colors.grey[700], fontSize: 12),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (req.assignedInterpreterName != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: Colors.green[50],
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.check_circle, size: 14, color: Color(0xFF046A38)),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Assigned: ${req.assignedInterpreterName}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF046A38)),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              if (req.activeSessionId != null && ['assigned', 'in_session'].contains(req.status)) ...[
                                const SizedBox(height: 10),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: FilledButton.icon(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFF046A38),
                                    ),
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => LiveCallScreen(sessionId: req.activeSessionId!),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.phone, size: 16),
                                    label: const Text('Join Live Room'),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
