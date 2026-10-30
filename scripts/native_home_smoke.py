#!/usr/bin/env python3
"""Read-only foreground/home smoke. No launch, session creation, taps or writes to apps.
Import and --self-check never connect to a device. Live mode requires explicit release.
"""
import argparse
import asyncio
import json
from pathlib import Path


def visible_labels(node):
    result = set()
    if isinstance(node, list):
        for item in node:
            result.update(visible_labels(item))
    elif isinstance(node, dict):
        if node.get('isVisible') in (False, 0, '0'):
            return result
        for key in ('label', 'name', 'value'):
            if isinstance(node.get(key), str) and node[key].strip():
                result.add(node[key].strip())
        for child in node.get('children', []):
            result.update(visible_labels(child))
    return result


def assess(config, active_before, installed, source, active_after):
    expected = config['bundle']
    if active_before.get('bundleId') != expected or active_after.get('bundleId') != expected:
        return {'status': 'BLOCKED', 'reason': 'Foreground bundle differs; no navigation attempted'}
    actual = installed.get(expected, {})
    if (actual.get('CFBundleShortVersionString'), str(actual.get('CFBundleVersion'))) != (config['version'], str(config['build'])):
        return {'status': 'BLOCKED', 'reason': 'Installed version/build differs from fixture'}
    labels = visible_labels(source)
    required = config['required_labels']
    missing = [label for label in required if label not in labels]
    forbidden = [label for label in config.get('forbidden_labels', []) if label in labels]
    return {'status': 'FAIL' if missing or forbidden else 'PASS',
            'scope': 'Foreground identity, installed build and expected home labels only',
            'bundle': expected, 'version': config['version'], 'build': str(config['build']),
            'required_labels': {label: label in labels for label in required},
            'missing_labels': missing, 'forbidden_present': forbidden,
            'note': 'Not a regression of learning, authentication, media or homework flows'}


async def installed_metadata(udid, bundle):
    from pymobiledevice3.lockdown import create_using_usbmux
    from pymobiledevice3.services.installation_proxy import InstallationProxyService
    lockdown = await create_using_usbmux(serial=udid)
    try:
        async with InstallationProxyService(lockdown=lockdown) as service:
            apps = await service.get_apps(bundle_identifiers=[bundle])
        # Keep only the identity fields; do not save full app inventory or personal IDs.
        fields = ('CFBundleIdentifier', 'CFBundleShortVersionString', 'CFBundleVersion')
        return {bundle: {key: apps.get(bundle, {}).get(key) for key in fields}}
    finally:
        await lockdown.close()


def live(args, config):
    if not args.released or not args.udid or not args.session_file:
        return {'status': 'BLOCKED', 'reason': 'Explicit device release, UDID and existing session file required'}
    import wda
    session_id = Path(args.session_file).read_text().strip()
    if not session_id:
        return {'status': 'BLOCKED', 'reason': 'Existing session file is empty'}
    # Frozen existing session disables library callbacks that could create a session.
    client = wda.Client('http+usbmux://' + args.udid + ':8100', _session_id=session_id)
    before = client.http.get('/wda/activeAppInfo', timeout=8).value
    if before.get('bundleId') != config['bundle']:
        return {'status': 'BLOCKED', 'reason': 'Wrong foreground app; source was not requested'}
    installed = asyncio.run(asyncio.wait_for(installed_metadata(args.udid, config['bundle']), timeout=15))
    actual = installed.get(config['bundle'], {})
    if (actual.get('CFBundleShortVersionString'), str(actual.get('CFBundleVersion'))) != (config['version'], str(config['build'])):
        return {'status': 'BLOCKED', 'reason': 'Wrong installed version/build; source was not requested'}
    source = client.http.get('source?format=json', timeout=12).value
    after = client.http.get('/wda/activeAppInfo', timeout=8).value
    return assess(config, before, installed, source, after)


def self_check():
    config = {'bundle': 'qa.example', 'version': '1.0', 'build': '2', 'required_labels': ['Home', 'Course'], 'forbidden_labels': ['Offline']}
    active = {'bundleId': 'qa.example'}
    installed = {'qa.example': {'CFBundleShortVersionString': '1.0', 'CFBundleVersion': '2'}}
    source = {'children': [{'label': 'Home', 'isVisible': True}, {'name': 'Course', 'isVisible': '1'}, {'label': 'Offline', 'isVisible': False}]}
    assert assess(config, active, installed, source, active)['status'] == 'PASS'
    assert assess(config, {'bundleId': 'other'}, installed, source, active)['status'] == 'BLOCKED'
    assert assess(config, active, {}, source, active)['status'] == 'BLOCKED'
    assert assess(config, active, installed, {'label': 'Home'}, active)['status'] == 'FAIL'
    assert assess(config, active, installed, {'children': [source, {'label': 'Offline'}]}, active)['status'] == 'FAIL'
    assert not visible_labels({'isVisible': False, 'children': [{'label': 'Hidden'}]})
    return {'status': 'PASS', 'scope': 'Six synthetic local checks of parser/guards only; no device or product tested'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-check', action='store_true')
    parser.add_argument('--config')
    parser.add_argument('--released', action='store_true')
    parser.add_argument('--udid')
    parser.add_argument('--session-file')
    parser.add_argument('--out')
    args = parser.parse_args()
    try:
        if args.self_check:
            result = self_check()
        else:
            config = json.loads(Path(args.config).read_text())
            assert config.get('required_labels'), 'Nonempty home fixture required'
            if args.out and Path(args.out).exists():
                raise ValueError('Output already exists')
            result = live(args, config)
    except Exception as error:
        # Do not expose session IDs, device identifiers, full source or library URLs.
        result = {'status': 'BLOCKED', 'reason': 'Transport/configuration unavailable: ' + type(error).__name__}
    if args.out:
        target = Path(args.out)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x') as output:
            output.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))
    return {'PASS': 0, 'FAIL': 1, 'BLOCKED': 2}[result['status']]


if __name__ == '__main__':
    raise SystemExit(main())
