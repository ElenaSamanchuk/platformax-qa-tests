#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Replay sanitized logcat responses against the 90% watch contract.

Reads only response blocks for the selected workout. It does not contact a
server, start playback, or prove that a ring updated. Run against a fresh trace
starting with an unwatched workout; require-crossing rejects incomplete traces.
"""
import argparse
import json
import re
import sys
from pathlib import Path


def responses(text, workout):
    rows = []
    active = None
    for raw in text.splitlines():
        line = re.sub(r'\x1b\[[0-9;]*m', '', raw)
        if '[http-' in line:
            if active and all(k in active for k in ('duration_ms', 'covered_ms', 'is_watched')):
                rows.append(active)
            active = None
            if '[http-response] [POST]' in line and re.search(r'/workouts/watch-progress/' + re.escape(str(workout)) + r'(?:\D|$)', line):
                time = re.search(r'\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+', line)
                active = {'time': time.group(0) if time else '', 'workout': str(workout)}
        if active is not None:
            match = re.search(r'"(duration_ms|covered_ms|is_watched)"\s*:\s*(\d+|true|false)', line)
            if match:
                value = match.group(2)
                active[match.group(1)] = {'true': True, 'false': False}.get(value) if value in ('true', 'false') else int(value)
                # Sanitized captures may omit unrelated endpoint delimiters.
                # Close as soon as the complete small response is read; later
                # unrelated is_watched fields must never overwrite this one.
                if all(k in active for k in ('duration_ms', 'covered_ms', 'is_watched')):
                    rows.append(active)
                    active = None
    if active and all(k in active for k in ('duration_ms', 'covered_ms', 'is_watched')):
        rows.append(active)
    return rows


def check(rows, require_crossing):
    errors = []
    if len(rows) < 2:
        return ['Need at least two complete matching server responses']
    durations = {row['duration_ms'] for row in rows}
    if len(durations) != 1 or min(durations) <= 0:
        errors.append('Duration must be positive and stable for one media item')
    previous = -1
    for i, row in enumerate(rows):
        duration, covered, watched = row['duration_ms'], row['covered_ms'], row['is_watched']
        if not 0 <= covered <= duration:
            errors.append('Response %d: coverage outside media duration' % i)
        if covered < previous:
            errors.append('Response %d: accumulated coverage regressed' % i)
        previous = covered
        expected = covered * 100 >= duration * 90
        if watched != expected:
            errors.append('Response %d: watched disagrees with the 90%% contract' % i)
    if rows[0]['is_watched']:
        errors.append('Baseline is already watched; select a fresh unwatched trace')
    if require_crossing and not any(row['is_watched'] for row in rows):
        errors.append('No positive 90% crossing observed; trace is incomplete')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--workout', required=True)
    parser.add_argument('--require-crossing', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    rows = responses(args.input.read_text(encoding='utf-8'), args.workout)
    errors = check(rows, args.require_crossing)
    result = {'scope': 'sanitized response replay, not a live app retest',
              'workout': args.workout, 'responses': len(rows),
              'passed': not errors, 'errors': errors, 'samples': rows}
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'samples'}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
