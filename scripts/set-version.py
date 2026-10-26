# Stamps a version on every module URL so the browser can never mix old cached files with new ones.
# Usage: python3 scripts/set-version.py 1.9.1
import re,sys,pathlib,json
v=sys.argv[1];d=pathlib.Path(__file__).resolve().parent.parent/'dist'
for f in d.glob('*.js'):
  s=f.read_text()
  s=re.sub(r"(from\s+'|import\(\s*')(\./[\w-]+\.js)(\?v=[^']*)?'",lambda m:f"{m.group(1)}{m.group(2)}?v={v}'",s)
  s=re.sub(r"export const VERSION='[^']*'",f"export const VERSION='{v}'",s)
  f.write_text(s)
h=d/'index.html';h.write_text(re.sub(r'(src|href)="(app\.js|style\.css)(\?v=[^"]*)?"',lambda m:f'{m.group(1)}="{m.group(2)}?v={v}"',h.read_text()))
(d/'version.json').write_text(json.dumps({'version':v})+'\n')
print('version',v)
