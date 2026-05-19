"""
Fix route timestamps so the new routes win the sync merge.
Sets all new routes to a future timestamp and all old deleted routes
to an even newer timestamp so deletions propagate.
"""
import json, sys, io, os, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Use a timestamp that's definitely newer than anything in the browser
NOW = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S.000Z')
print('Using timestamp: {}'.format(NOW))

for fname in ['data/seed.json', 'data/sync-data.json']:
    fpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    routes = data.get('routes', [])

    # Update ALL route timestamps to now so they win the merge
    for r in routes:
        r['updatedAt'] = NOW

    # Also bump version for sync-data
    if 'version' in data:
        data['version'] = data.get('version', 0) + 1
        data['lastSyncAt'] = NOW

    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    active = [r for r in routes if not r.get('_deleted')]
    deleted = [r for r in routes if r.get('_deleted')]
    print('{}: {} active, {} deleted, all timestamps set to NOW'.format(fname, len(active), len(deleted)))

print()
print('Done. The server will now serve routes with the newest timestamps.')
print('On next sync, the browser will accept these as the winning versions.')
