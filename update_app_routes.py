"""
Update the sales app seed.json and sync-data.json with the new
routes from the 400 BBL sales strategy plan.

Reads the updated routes from bob-sales-backup-2026-03-31.json
(which already has the new 45-stop, 3-week route plan) and writes
them into both app data files so the app picks them up on next
seed load or sync.
"""
import json, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BACKUP = r'C:\Users\crino\Desktop\Brewery Sales\bob-sales-backup-2026-03-31.json'
SEED = os.path.join(os.path.dirname(__file__), 'data', 'seed.json')
SYNC = os.path.join(os.path.dirname(__file__), 'data', 'sync-data.json')

# Load new routes from the backup
with open(BACKUP, 'r') as f:
    backup = json.load(f)

new_routes = backup['routes']
print('New routes from backup: {} stops'.format(len(new_routes)))

# --- Update seed.json ---
with open(SEED, 'r') as f:
    seed = json.load(f)

old_seed_routes = seed.get('routes', [])
old_active = [r for r in old_seed_routes if not r.get('_deleted')]
print('Old seed.json routes: {} active'.format(len(old_active)))

# Soft-delete all old routes so they get removed on sync
for r in old_seed_routes:
    if not r.get('_deleted'):
        r['_deleted'] = True
        r['updatedAt'] = backup.get('exportedAt', '2026-04-01T00:00:00')

# Add new routes
seed['routes'] = old_seed_routes + new_routes
seed['exportedAt'] = backup.get('exportedAt', '2026-04-01T00:00:00')

with open(SEED, 'w') as f:
    json.dump(seed, f, indent=2)
print('Updated seed.json: {} old (soft-deleted) + {} new = {} total'.format(
    len(old_seed_routes), len(new_routes), len(seed['routes'])))

# --- Update sync-data.json ---
with open(SYNC, 'r') as f:
    sync = json.load(f)

old_sync_routes = sync.get('routes', [])
old_sync_active = [r for r in old_sync_routes if not r.get('_deleted')]
print('Old sync-data.json routes: {} active'.format(len(old_sync_active)))

# Soft-delete all old routes
for r in old_sync_routes:
    if not r.get('_deleted'):
        r['_deleted'] = True
        r['updatedAt'] = backup.get('exportedAt', '2026-04-01T00:00:00')

# Add new routes
sync['routes'] = old_sync_routes + new_routes
sync['version'] = sync.get('version', 0) + 1
sync['lastSyncAt'] = backup.get('exportedAt', '2026-04-01T00:00:00')

with open(SYNC, 'w') as f:
    json.dump(sync, f, indent=2)
print('Updated sync-data.json: {} old (soft-deleted) + {} new = {} total'.format(
    len(old_sync_routes), len(new_routes), len(sync['routes'])))
print('Sync version bumped to: {}'.format(sync['version']))

print()
print('Done! The app will pick up the new routes on next:')
print('  - "Load All Brewery Data" (seed.json)')
print('  - Auto-sync cycle (sync-data.json)')
