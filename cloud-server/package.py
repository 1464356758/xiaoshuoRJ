#!/usr/bin/env python3
"""Package only public deployment inputs. Never copies a live data directory."""
import argparse
import hashlib
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
bundle = root / 'cloud-server/generated/workspace-api.mjs'
if not bundle.is_file():
    raise SystemExit('Run node cloud-server/build-server.mjs first')
files = [root / 'Dockerfile', root / '.dockerignore', root / 'docs/CLOUD_CONTROL_V011.md',
         root / 'app/api/workspace/route.ts', root / 'android-standalone/runtime/adapt-source.mjs', bundle]
files.extend(sorted((root / 'lib').glob('*.mjs')))
files.extend(sorted(p for p in (root / 'cloud-server').iterdir() if p.is_file()
                    and p.name in {'README.md', 'build-server.mjs', 'schema.sql', 'storage.mjs',
                                   'service.mjs', 'main.mjs', 'entry.mjs', 'admin.mjs', 'healthcheck.mjs',
                                   'compose.yaml', 'Caddyfile', 'deploy.sh', 'package.py'}))
private = re.compile(rb'sk-[A-Za-z0-9_-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----')
checks = []
args.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(set(files)):
        if not path.is_file() or path.is_symlink():
            raise SystemExit('Missing or unexpected source: ' + str(path.relative_to(root)))
        content = path.read_bytes()
        if private.search(content):
            raise SystemExit('Unexpected credential pattern: ' + str(path.relative_to(root)))
        name = path.relative_to(root).as_posix()
        checks.append(hashlib.sha256(content).hexdigest() + '  ' + name)
        archive.writestr(name, content)
    archive.writestr('README-FIRST.md', '# 小说工厂云端运行 0.11.1\n\n先阅读 docs/CLOUD_CONTROL_V011.md 与 cloud-server/README.md。\n'
                     '此包不含个人凭证或小说。Node 24 可直接运行 cloud-server/main.mjs；Railway 自动识别根 Dockerfile。\n'
                     '部署后必须挂载 /data 持久盘、关闭休眠、配置 HTTPS 并在私有终端配对手机。\n'
                     '独立服务已在Railway完成首次上线验证；此包不含个人连接凭证，新服务模型费用默认关闭。\n')
    archive.writestr('SHA256SUMS', '\n'.join(checks) + '\n')
print('Packaged', len(checks), 'public source files:', args.output.name)
print('SHA256', hashlib.sha256(args.output.read_bytes()).hexdigest())
