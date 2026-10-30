import json
import unittest

from app.models.platform_setting import PlatformSetting
from app.models.user import User
from app.services.notification_service import NotificationService

PASSWORD_TEMPLATE = (
    "Hello, {{ user_full_name }}!\n"
    "Sign-in email: {{ user_email }}\n"
    "Temporary password: {{ temporary_password }}{{ recovery_token }}\n"
    "We recommend changing your password after the first sign-in."
)


class NotificationPasswordEmailTests(unittest.TestCase):
    def test_english_temporary_password_line_fills_template(self) -> None:
        inferred = NotificationService._infer_template_context_from_lines(
            [
                "Email: merchant@example.com",
                "Temporary password: S3cret-pass",
                "We recommend changing your password after the first sign-in.",
            ]
        )
        self.assertEqual(inferred["temporary_password"], "S3cret-pass")
        self.assertEqual(inferred["user_email"], "merchant@example.com")

    def test_credentials_template_includes_password_from_approval_lines(self) -> None:
        rendered = self._render(
            lines=[
                "Email: merchant@example.com",
                "Temporary password: S3cret-pass",
                "We recommend changing your password after the first sign-in.",
            ],
        )
        self.assertIn("Hello, Andrew!", rendered.email_text)
        self.assertIn("Sign-in email: merchant@example.com", rendered.email_text)
        self.assertIn("Temporary password: S3cret-pass", rendered.email_text)
        self.assertNotIn("Temporary password:\n", rendered.email_text + "\n")

    def test_explicit_context_password_is_not_dropped(self) -> None:
        rendered = self._render(
            lines=["Cabinet access issued."],
            extra_context={"temporary_password": "FromContext-1"},
        )
        self.assertIn("Temporary password: FromContext-1", rendered.email_text)

    def test_recovery_token_is_shown_without_blank_password_line(self) -> None:
        rendered = self._render(
            lines=[
                "Email: merchant@example.com",
                "Recovery token: recover-token-1",
            ],
            extra_context={"recovery_token": "\nRecovery token: recover-token-1"},
        )
        self.assertIn("Recovery token: recover-token-1", rendered.email_text)
        self.assertNotIn("Temporary password:", rendered.email_text)

    def test_english_project_line_fills_tenant_name(self) -> None:
        inferred = NotificationService._infer_template_context_from_lines(
            ["Project: Andrew Shop"]
        )
        self.assertEqual(inferred["tenant_name"], "Andrew Shop")

    def _render(self, *, lines: list[str], extra_context: dict[str, str] | None = None):
        settings = PlatformSetting(
            code="default",
            notification_templates_json=json.dumps(
                {
                    "password_generated": {
                        "email_subject": "{{ brand_name }}: sign-in credentials",
                        "message_lines": PASSWORD_TEMPLATE,
                    }
                }
            ),
            notification_brand_name="NorenDigital",
        )
        user = User(
            email="merchant@example.com",
            password_hash="hashed",
            full_name="Andrew",
            role="tenant_owner",
            status="active",
        )
        return NotificationService(None)._render_notification_payload(
            platform_settings=settings,
            user=user,
            event_code=NotificationService.EVENT_PASSWORD_GENERATED,
            fallback_subject="Merchant cabinet sign-in password generated",
            fallback_lines=lines,
            extra_context=extra_context,
        )
