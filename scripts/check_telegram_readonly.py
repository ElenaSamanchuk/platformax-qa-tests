#!/usr/bin/env python3
"""Read-only Telegram bot smoke: getMe and getWebhookInfo, never send/update."""

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def api_get(token, method):
    # Token occurs only in the required HTTPS request, never in result/log output.
    request = Request("https://api.telegram.org/bot" + token + "/" + method,
                      headers={"Accept": "application/json"}, method="GET")
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            return None, {"method": method, "kind": "response_too_large"}
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            return None, {"method": method, "kind": "telegram_not_ok"}
        result = payload.get("result")
        if not isinstance(result, dict):
            return None, {"method": method, "kind": "invalid_result"}
        return result, None
    except HTTPError as error:
        return None, {"method": method, "kind": "http_error", "http_status": error.code}
    except URLError:
        return None, {"method": method, "kind": "network_error"}
    except (TimeoutError, OSError):
        return None, {"method": method, "kind": "network_error"}
    except (ValueError, UnicodeError):
        return None, {"method": method, "kind": "invalid_json"}


def run_checks(token, expected_username, expected_host):
    report = {"checked_at_utc": utc_now(), "ok": False, "checks": [],
              "errors": [], "info": {}}

    def check(name, passed):
        report["checks"].append({"name": name, "passed": bool(passed)})

    me, me_error = api_get(token, "getMe")
    webhook, webhook_error = api_get(token, "getWebhookInfo")
    for error in (me_error, webhook_error):
        if error:
            report["errors"].append(error)
    check("getMe_ok", me is not None)
    check("is_bot", me is not None and me.get("is_bot") is True)
    check("expected_bot_username", me is not None and
          me.get("username") == expected_username)
    check("getWebhookInfo_ok", webhook is not None)

    # Do not copy API dictionaries, names, ids, raw URL, or error messages.
    parsed = None
    if webhook is not None and isinstance(webhook.get("url"), str):
        try:
            parsed = urlsplit(webhook["url"])
            host_matches = parsed.hostname == expected_host
        except ValueError:
            host_matches = False
    else:
        host_matches = False
    check("webhook_https", parsed is not None and parsed.scheme == "https")
    check("expected_webhook_host", host_matches)
    pending = webhook.get("pending_update_count") if webhook is not None else None
    check("empty_update_queue", type(pending) is int and pending == 0)
    if type(pending) is int:
        report["info"]["pending_update_count"] = pending
    report["info"]["has_historical_last_error"] = bool(
        webhook is not None and
        (webhook.get("last_error_date") or webhook.get("last_error_message")))
    error_date = webhook.get("last_error_date") if webhook is not None else None
    if type(error_date) is int:
        try:
            report["info"]["historical_last_error_at_utc"] = dt.datetime.fromtimestamp(
                error_date, dt.timezone.utc).isoformat().replace("+00:00", "Z")
        except (ValueError, OverflowError, OSError):
            pass
    report["ok"] = not report["errors"] and all(
        item["passed"] for item in report["checks"])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-stdin", action="store_true", required=True,
                        help="Read the bot token only from standard input")
    parser.add_argument("--expected-username", required=True)
    parser.add_argument("--expected-host", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = sys.stdin.read(4097).strip()
    if len(token) > 4096 or not re.fullmatch(r"\d{5,}:[A-Za-z0-9_-]{20,}", token):
        report = {"checked_at_utc": utc_now(), "ok": False, "checks": [],
                  "errors": [{"kind": "missing_or_invalid_stdin_token"}], "info": {}}
    else:
        report = run_checks(token, args.expected_username, args.expected_host)
    del token
    try:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")
    except OSError:
        print("FAIL: could not write redacted output", file=sys.stderr)
        return 1
    print("PASS" if report["ok"] else "FAIL")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
