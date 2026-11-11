# Generated migration for ORZO Interpretation Session Records
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('api', '__first__'),
    ]

    operations = [
        migrations.CreateModel(
            name='InterpretationSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('session_reference', models.CharField(db_index=True, max_length=64, unique=True)),
                ('request_reference', models.CharField(db_index=True, max_length=64)),
                ('customer_id', models.CharField(blank=True, db_index=True, max_length=64)),
                ('customer_name', models.CharField(blank=True, max_length=160)),
                ('interpreter_id', models.CharField(blank=True, db_index=True, max_length=64, null=True)),
                ('interpreter_name', models.CharField(blank=True, max_length=160)),
                ('room_name', models.CharField(db_index=True, max_length=128, unique=True)),
                ('communication_type', models.CharField(choices=[('audio', 'Audio Only'), ('video', 'Two-Way Video')], default='audio', max_length=24)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('ready', 'Ready to Join'), ('active', 'Active Call'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('failed', 'Failed')], db_index=True, default='ready', max_length=32)),
                ('source_language', models.CharField(blank=True, db_index=True, max_length=16)),
                ('target_language', models.CharField(blank=True, db_index=True, max_length=16)),
                ('scheduled_start_time', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('actual_start_time', models.DateTimeField(blank=True, null=True)),
                ('actual_end_time', models.DateTimeField(blank=True, null=True)),
                ('duration_seconds', models.PositiveIntegerField(default=0)),
                ('cancellation_reason', models.TextField(blank=True, null=True)),
                ('completion_notes', models.TextField(blank=True, null=True)),
                ('created_by', models.CharField(blank=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customer_sessions', to='api.account')),
                ('interpreter_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='interpreter_sessions', to='api.account')),
                ('request', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='interpretation_sessions', to='api.interpretationrequest')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SessionParticipant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.CharField(db_index=True, max_length=64)),
                ('user_name', models.CharField(max_length=160)),
                ('role', models.CharField(choices=[('customer', 'Customer / Client'), ('interpreter', 'Assigned Interpreter'), ('coordinator', 'Supervisor / Coordinator')], max_length=32)),
                ('connection_status', models.CharField(choices=[('authorized', 'Authorized'), ('joined', 'Joined'), ('disconnected', 'Disconnected'), ('left', 'Left')], default='authorized', max_length=32)),
                ('join_timestamp', models.DateTimeField(blank=True, null=True)),
                ('leave_timestamp', models.DateTimeField(blank=True, null=True)),
                ('activity_info', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='communications.interpretationsession')),
                ('user_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='session_participations', to='api.account')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='SessionEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(db_index=True, max_length=64)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('actor_id', models.CharField(blank=True, db_index=True, max_length=64, null=True)),
                ('timestamp', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('actor_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.account')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='communications.interpretationsession')),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['request_reference', 'status'], name='comm_req_status_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['customer_id', 'status'], name='comm_cust_status_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['interpreter_id', 'status'], name='comm_int_status_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['source_language', 'target_language'], name='comm_lang_pair_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['status', 'created_at'], name='comm_status_created_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['scheduled_start_time'], name='comm_sched_time_idx'),
        ),
        migrations.AddIndex(
            model_name='interpretationsession',
            index=models.Index(fields=['created_at'], name='comm_created_idx'),
        ),
        migrations.AddIndex(
            model_name='sessionparticipant',
            index=models.Index(fields=['session', 'user_id'], name='part_session_user_idx'),
        ),
        migrations.AddIndex(
            model_name='sessionparticipant',
            index=models.Index(fields=['user_id', 'role'], name='part_user_role_idx'),
        ),
        migrations.AddIndex(
            model_name='sessionevent',
            index=models.Index(fields=['session', 'timestamp'], name='event_session_time_idx'),
        ),
        migrations.AddIndex(
            model_name='sessionevent',
            index=models.Index(fields=['event_type', 'timestamp'], name='event_type_time_idx'),
        ),
    ]
