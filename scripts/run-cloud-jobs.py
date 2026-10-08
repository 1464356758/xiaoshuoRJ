#!/usr/bin/env python3
"""Run owner-authorized jobs without a browser; secrets enter only via stdin.

Input JSON: {url, token, max_steps?:80, max_seconds?:1200}.
The Sites dispatcher verifies/consumes the service credential. This script is
only for the same confirmed owner-private Site, never for an arbitrary URL.
No fiction text, owner IDs, keys or tokens are printed or saved.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def run(opts):
    url = opts['url'].rstrip('/')
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname.endswith('.chatgpt.site') or parsed.path:
        raise ValueError('Only the selected HTTPS private Site origin is allowed')
    token = opts['token']
    if not isinstance(token, str) or not token:
        raise ValueError('A current Site service credential is required')
    limit = max(1, min(80, int(opts.get('max_steps', 80))))
    seconds = max(1, min(1200, int(opts.get('max_seconds', 1200))))
    started = time.monotonic()
    advances = 0
    idle = 0
    for _ in range(limit):
        if time.monotonic() - started >= seconds:
            break
        request = urllib.request.Request(url + '/api/runner',
            data=b'{"action":"tick"}', method='POST',
            headers={'Content-Type': 'application/json',
                     'OAI-Sites-Authorization': 'Bearer ' + token})
        try:
            with urllib.request.urlopen(request, timeout=115) as response:
                state = json.load(response)
        except urllib.error.HTTPError as error:
            # Never echo a response body or full URL that might contain data.
            print(json.dumps({'stopped': True, 'http_status': error.code}), flush=True)
            return 1
        except (urllib.error.URLError, TimeoutError):
            # A timeout can mean a charged request was already accepted. Do not retry.
            print(json.dumps({'stopped': True, 'reason': 'connection_uncertain_no_retry'}), flush=True)
            return 1
        except json.JSONDecodeError:
            print(json.dumps({'stopped': True, 'reason': 'non_json_service_response'}), flush=True)
            return 1
        safe = {key: state.get(key) for key in ('advanced', 'phase', 'activeJobs', 'lastTick', 'stopReason')}
        print(json.dumps(safe, ensure_ascii=False), flush=True)
        advances += int(bool(state.get('advanced')))
        if state.get('stopReason') == 'idle' or not state.get('activeJobs'):
            break
        if state.get('advanced'):
            idle = 0
        elif state.get('stopReason') in ('waiting', 'claimed', 'checkpoint_busy'):
            idle += 1
            if idle >= 6:
                break
            time.sleep(5)
    print(json.dumps({'advanced_checkpoints': advances, 'finished_batch': True}), flush=True)
    return 0


if __name__ == '__main__':
    try:
        # PTY sessions are supported without echoing the incoming credential.
        if sys.stdin.isatty():
            import termios
            previous = termios.tcgetattr(sys.stdin)
            hidden = termios.tcgetattr(sys.stdin)
            hidden[3] &= ~termios.ECHO
            termios.tcsetattr(sys.stdin, termios.TCSANOW, hidden)
            print('Ready for private runner JSON on stdin (input hidden).', flush=True)
            try:
                opts = json.loads(sys.stdin.readline())
            finally:
                termios.tcsetattr(sys.stdin, termios.TCSANOW, previous)
        else:
            opts = json.loads(sys.stdin.readline())
        sys.exit(run(opts))
    except (KeyError, ValueError, TypeError):
        print(json.dumps({'stopped': True, 'reason': 'invalid_runner_input'}), flush=True)
        sys.exit(1)
