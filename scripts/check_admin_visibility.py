# -*- coding: utf-8 -*-
"""Offline comparison of saved web product flags and native AX switches.

No network, device, AI, authentication, or app mutations. See
README-admin-visibility.md for the input contract and evidence boundaries.
"""
import argparse
import hashlib
import json
from pathlib import Path


class Blocked(ValueError):
    pass


def read_evidence(path):
    try:
        raw = Path(path).read_bytes()
        return json.loads(raw.decode("utf-8")), hashlib.sha256(raw).hexdigest()
    except (OSError, UnicodeError, ValueError):
        raise Blocked("Evidence is missing or is not UTF-8 JSON")


def product_rows(web):
    # Supported: a saved Inertia response, or the sanitized readonly snapshot.
    if not isinstance(web, dict):
        raise Blocked("Web snapshot must be an object")
    container = web.get("props") or web.get("data")
    if not isinstance(container, dict):
        raise Blocked("Web snapshot lacks props/data")
    paginator = container.get("paginator")
    rows = paginator.get("data") if isinstance(paginator, dict) else None
    if not isinstance(rows, list):
        raise Blocked("Web snapshot lacks paginator.data")
    return rows


def walk(node):
    if isinstance(node, dict):
        yield node
        for child in node.get("children", []):
            yield from walk(child)


def visible(node):
    # Reject absent visibility: hidden nodes must not supply evidence.
    return node.get("isVisible") in (True, 1, "1")


def assess(rows, ax, product_id, expected_name):
    if type(product_id) is not int or product_id <= 0 or not expected_name:
        raise Blocked("Positive product ID and exact product name required")
    matches = [row for row in rows if isinstance(row, dict)
               and type(row.get("id")) is int and row["id"] == product_id]
    if len(matches) != 1 or matches[0].get("name") != expected_name:
        raise Blocked("Web product ID/name does not uniquely match the fixture")
    server = matches[0].get("is_admin_visible")
    if type(server) is not bool:
        raise Blocked("is_admin_visible must be a JSON boolean")
    if not isinstance(ax, dict):
        raise Blocked("AX source must be an object")
    nodes = list(walk(ax))
    headers = [node for node in nodes if visible(node)
               and "Header" in str(node.get("traits", ""))
               and node.get("label") == expected_name]
    if not headers:
        raise Blocked("Native visible product header does not match the fixture")
    switches = [node for node in nodes if visible(node)
                and node.get("type") in ("Switch", "XCUIElementTypeSwitch")
                and node.get("label") == "Видно только админам"
                and (node.get("rawIdentifier") == "field-is_admin_visible"
                     or node.get("name") == "field-is_admin_visible")]
    if len(switches) != 1:
        raise Blocked("Exactly one visible admin-visibility switch required")
    switch = switches[0]
    if switch.get("isEnabled") not in (True, 1, "1"):
        raise Blocked("Native admin-visibility switch is not enabled")
    state = switch.get("value")
    if type(state) is not str or state not in ("0", "1"):
        raise Blocked("Native switch value must be exactly string 0 or 1")
    native = state == "1"
    return {"product_id": product_id, "product_name": expected_name,
            "status": "PASS" if native == server else "FAIL",
            "bug_id": "M-1012-STATE" if native != server else None,
            "server_field": "is_admin_visible", "server_value": server,
            "native_switch_value": state, "native_value": native,
            "reason": "Values agree" if native == server
            else "Saved server flag and displayed native switch disagree"}


def self_check():
    import copy
    rows=[{"id":1,"name":"QA-Example","is_admin_visible":True}]
    ax={"children":[{"type":"StaticText","label":"QA-Example","traits":"Header","isVisible":"1"},
         {"type":"Switch","label":"Видно только админам","name":"field-is_admin_visible","value":"0","isVisible":"1","isEnabled":"1"}]}
    if assess(rows,ax,1,"QA-Example")["status"] != "FAIL": raise AssertionError("mismatch")
    positive=copy.deepcopy(ax);positive["children"][1]["value"]="1"
    if assess(rows,positive,1,"QA-Example")["status"] != "PASS": raise AssertionError("match")
    count=2
    for kind in ("name","id","boolean","value","duplicate","hidden"):
        r=copy.deepcopy(rows);a=copy.deepcopy(ax);pid=1;name="QA-Example"
        if kind=="name": name="Other"
        if kind=="id": pid=2
        if kind=="boolean": r[0]["is_admin_visible"]="true"
        if kind=="value": a["children"][1]["value"]="off"
        if kind=="duplicate": a["children"].append(copy.deepcopy(a["children"][1]))
        if kind=="hidden": a["children"][0]["isVisible"]="0"
        try: assess(r,a,pid,name)
        except Blocked: count+=1
        else: raise AssertionError(kind)
    return {"status":"PASS","checks":count,"scope":"Synthetic parser/guard controls only; no network/device/AI"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true")
    parser.add_argument("--web")
    parser.add_argument("--case", action="append", nargs=3,
                        metavar=("PRODUCT_ID", "EXACT_NAME", "AX_JSON"))
    parser.add_argument("--out")
    args = parser.parse_args()
    if args.self_check:
        print(json.dumps(self_check(), ensure_ascii=False))
        return 0
    if not args.web or not args.case:
        parser.error("--web and at least one --case are required")
    results = []
    try:
        web, web_sha = read_evidence(args.web)
        rows = product_rows(web)
        ids = set()
        for raw_id, name, source in args.case:
            try:
                product_id = int(raw_id)
                if product_id in ids:
                    raise Blocked("Duplicate product ID in cases")
                ids.add(product_id)
                ax, ax_sha = read_evidence(source)
                result = assess(rows, ax, product_id, name)
                result["ax_sha256"] = ax_sha
            except (Blocked, ValueError) as error:
                result = {"status": "BLOCKED", "reason": str(error)}
            results.append(result)
        status = "BLOCKED" if any(x["status"] == "BLOCKED" for x in results) else (
            "FAIL" if any(x["status"] == "FAIL" for x in results) else "PASS")
        summary = {"status": status, "scope": "Offline saved-evidence comparison only",
                   "web_sha256": web_sha, "cases": results,
                   "limitations": "Does not read the live server or device; does not prove freshness, persistence, or saving"}
    except Blocked as error:
        summary = {"status": "BLOCKED", "reason": str(error), "cases": results}
    if args.out:
        try:
            # Never silently replace a previous run's evidence.
            with Path(args.out).open("x", encoding="utf-8") as output:
                output.write(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
        except OSError:
            summary = {"status": "BLOCKED", "reason": "Output could not be created; use a new output path"}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return {"PASS": 0, "FAIL": 1, "BLOCKED": 2}[summary["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
