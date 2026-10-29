#!/usr/bin/env python3
"""Offline contract checks; no network and no credentials."""

import io
import json
import unittest
from unittest.mock import patch

import check_telegram_readonly as checker


class TelegramReadonlyTests(unittest.TestCase):
    def run_fixture(self, pending):
        responses = [
            {"ok": True, "result": {"is_bot": True, "username": "fixture_bot"}},
            {"ok": True, "result": {
                "url": "https://fixture.example/webhook/private-path",
                "pending_update_count": pending,
                "last_error_date": 1700000000,
                "last_error_message": "Historical fixture error; not copied to output"}},
        ]

        def fake_urlopen(request, timeout):
            self.assertEqual(request.get_method(), "GET")
            self.assertEqual(timeout, 20)
            return io.BytesIO(json.dumps(responses.pop(0)).encode("utf-8"))

        with patch.object(checker, "urlopen", side_effect=fake_urlopen) as opened:
            report = checker.run_checks("offline-placeholder", "fixture_bot", "fixture.example")
        self.assertEqual(opened.call_count, 2)
        self.assertFalse(responses)
        output = json.dumps(report)
        for forbidden in ("offline-placeholder", "private-path", "Historical fixture error"):
            self.assertNotIn(forbidden, output)
        return report

    def test_empty_queue_passes_with_historical_error(self):
        report = self.run_fixture(0)
        self.assertTrue(report["ok"])
        self.assertTrue(report["info"]["has_historical_last_error"])

    def test_pending_queue_fails(self):
        report = self.run_fixture(1)
        self.assertFalse(report["ok"])
        self.assertFalse(next(item["passed"] for item in report["checks"]
                              if item["name"] == "empty_update_queue"))


if __name__ == "__main__":
    unittest.main()
