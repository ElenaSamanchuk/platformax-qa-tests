#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Synthetic regression tests for the offline watch-response oracle; no network."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('watch_contract', Path(__file__).with_name('check-watch-progress-contract.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)


def row(covered, watched, duration=100000):
    return {'duration_ms': duration, 'covered_ms': covered, 'is_watched': watched}


class WatchContractTests(unittest.TestCase):
    def test_real_threshold_crossing(self):
        self.assertEqual(oracle.check([row(89999, False), row(90000, True)], True), [])

    def test_incomplete_trace_is_not_positive_pass(self):
        self.assertIn('No positive 90% crossing observed; trace is incomplete', oracle.check([row(1, False), row(89999, False)], True))

    def test_premature_mark_rejected(self):
        self.assertTrue(oracle.check([row(1, False), row(89999, True)], True))

    def test_late_mark_rejected(self):
        self.assertTrue(oracle.check([row(1, False), row(90000, False)], False))

    def test_coverage_regression_rejected(self):
        self.assertTrue(oracle.check([row(40000, False), row(39000, False)], False))

    def test_changing_duration_rejected(self):
        self.assertTrue(oracle.check([row(1, False), row(2, False, 200000)], False))

    def test_coverage_outside_duration_rejected(self):
        self.assertTrue(oracle.check([row(1, False), row(100001, True)], True))

    def test_unrelated_watched_does_not_override_completed_response(self):
        trace = '''10-29 12:00:00.000 [http-response] [POST] https://example.invalid/api/v2/workouts/watch-progress/42
"duration_ms": 100000,
"covered_ms": 89999,
"is_watched": false
unrelated object:
"is_watched": true
10-29 12:00:01.000 [http-response] [POST] https://example.invalid/api/v2/workouts/watch-progress/42
"duration_ms": 100000,
"covered_ms": 90000,
"is_watched": true
'''
        samples = oracle.responses(trace, '42')
        self.assertEqual([x['is_watched'] for x in samples], [False, True])
        self.assertEqual(oracle.check(samples, True), [])


if __name__ == '__main__':
    unittest.main()
