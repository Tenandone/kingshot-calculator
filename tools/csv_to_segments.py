# tools/csv_to_segments.py
# CSV(hero-stat-comparisons.csv) -> hero-levels.segments.json
import csv, re, json
from statistics import median
from pathlib import Path

BASE = Path(__file__).parent
SRC  = BASE / 'hero-stat-comparisons.csv'
DST  = BASE / 'hero-levels.segments.json'

def parse_stat(text):
    if not text: return None
    m = re.search(r'is\s*\+([0-9]+(?:\.[0-9]+)?)%\s*Attack/Defense', text)
    if m: return float(m.group(1))
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*%', text)
    return float(m.group(1)) if m else None

def as_int(x):
    try: return int(float(x))
    except: return None

def compress_deltas(levels, vals, tol=0.08):
    segs=[]; curr_from=None; curr_to=None; curr_delta=None
    for i in range(1,len(levels)):
        L=levels[i]; d=vals[i]-vals[i-1]
        if curr_from is None:
            curr_from=curr_to=L; curr_delta=d
        else:
            if abs(d-curr_delta)<=tol:
                curr_to=L; curr_delta=(curr_delta+d)/2
            else:
                segs.append({"from":int(curr_from),"to":int(curr_to),"delta":round(curr_delta,4)})
                curr_from=curr_to=L; curr_delta=d
    if curr_from is not None:
        segs.append({"from":int(curr_from),"to":int(curr_to),"delta":round(curr_delta,4)})
    return round(vals[0],4), segs

# CSV 읽기 (필요 컬럼 탐색: hero1 / levelValue / text)
with SRC.open('r', encoding='utf-8') as f:
    rdr = csv.DictReader(f)
    headers = [h.strip() for h in rdr.fieldnames]
    lower = {h.lower(): h for h in headers}
    for need in ['hero1','levelvalue','text']:
        if need not in lower:
            raise SystemExit(f"[ERROR] CSV에 '{need}' 컬럼이 없습니다. 현재: {headers}")
    H = lower['hero1']; LCOL = lower['levelvalue']; TC = lower['text']

    bucket = {}    # hero -> level -> [stats...]
    levels_set = set()
    for row in rdr:
        name = (row.get(H,'') or '').strip()
        lv   = as_int(row.get(LCOL,''))
        st   = parse_stat(row.get(TC,'')) if row.get(TC) else None
        if not name or lv is None or st is None: 
            continue
        bucket.setdefault(name,{}).setdefault(lv,[]).append(st)
        levels_set.add(lv)

levels_present = sorted(levels_set) or [0]
model = {"levels_min": levels_present[0], "levels_max": levels_present[-1], "heroes": {}}

for hero, lvmap in bucket.items():
    lv_sorted = sorted(lvmap)
    vals = [median(lvmap[L]) for L in lv_sorted]  # 레벨별 중앙값
    base, segs = compress_deltas(lv_sorted, vals, tol=0.08)
    model["heroes"][hero] = {"base": base, "segments": segs}

DST.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"[OK] wrote {DST.name} | heroes={len(model['heroes'])} | levels {model['levels_min']}..{model['levels_max']}")
