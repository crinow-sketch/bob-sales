"""
Geocode all BOB Sales accounts and set default business hours.

Usage:
  python geocode_accounts.py [SERVER_URL]

By default connects to https://bob-sales.onrender.com.
Uses OpenStreetMap Nominatim (free, no API key needed).
Respects rate limit: 1 request per second.
"""
import json
import time
import urllib.request
import urllib.parse
import sys

SERVER = sys.argv[1] if len(sys.argv) > 1 else "https://bob-sales.onrender.com"

# Use Photon (Komoot) geocoder — same OSM data, more lenient rate limits
PHOTON_URL = "https://photon.komoot.io/api"

# Default hours for Buffalo bars (most are 11am–2am, Sunday shorter)
DEFAULT_HOURS = {
    "mon": "11:00-02:00",
    "tue": "11:00-02:00",
    "wed": "11:00-02:00",
    "thu": "11:00-02:00",
    "fri": "11:00-02:00",
    "sat": "11:00-02:00",
    "sun": "12:00-00:00"
}


def geocode(name, address, city):
    """Look up lat/lng from Nominatim. Returns (lat, lng) or (None, None)."""
    queries = []
    if address and city:
        queries.append(f"{address}, {city}, NY")
    if name and city:
        queries.append(f"{name}, {city}, NY")
    if name:
        queries.append(f"{name}, Buffalo, NY")

    for q in queries:
        params = urllib.parse.urlencode({
            'q': q, 'limit': 1, 'lat': 42.89, 'lon': -78.88  # Bias towards Buffalo
        })
        url = f"{PHOTON_URL}?{params}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'BOBSalesTracker/1.0'
        })
        try:
            resp = urllib.request.urlopen(req, timeout=10)
            data = json.loads(resp.read())
            features = data.get('features', [])
            if features:
                coords = features[0]['geometry']['coordinates']
                lon, lat = coords[0], coords[1]
                # Sanity check: should be roughly in the Buffalo/WNY area
                if 42.0 < lat < 43.5 and -79.5 < lon < -78.0:
                    return lat, lon
        except Exception as e:
            if '429' in str(e) or '403' in str(e):
                print("(rate limited, waiting 30s) ", end='', flush=True)
                time.sleep(30)
                continue
            print(f"    Error: {e}")
        time.sleep(1.5)

    return None, None


def main():
    print(f"Fetching data from {SERVER}...")
    resp = urllib.request.urlopen(f"{SERVER}/api/sync", timeout=30)
    data = json.loads(resp.read())
    accounts = data.get('accounts', [])
    active = [a for a in accounts if not a.get('_deleted')]
    print(f"  Found {len(active)} active accounts ({len(accounts)} total)")

    updated = 0
    geocoded = 0
    failed_geo = 0
    skipped = 0

    for i, acct in enumerate(accounts):
        if acct.get('_deleted'):
            continue

        name = acct.get('name', '')
        changed = False

        # Geocode if no coordinates
        if not acct.get('lat') or not acct.get('lng'):
            print(f"  [{i+1}/{len(accounts)}] {name}... ", end='', flush=True)
            lat, lng = geocode(name, acct.get('address', ''), acct.get('city', ''))
            if lat and lng:
                acct['lat'] = lat
                acct['lng'] = lng
                changed = True
                geocoded += 1
                print(f"OK ({lat:.4f}, {lng:.4f})")
            else:
                failed_geo += 1
                print("FAILED")
        else:
            skipped += 1

        # Set default hours if none exist
        if not acct.get('hours'):
            acct['hours'] = dict(DEFAULT_HOURS)
            changed = True

        if changed:
            acct['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            updated += 1

    # Push updated data back to server
    print(f"\nPushing {updated} updated accounts to server...")
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(
        f"{SERVER}/api/sync",
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())

    print(f"\nDone!")
    print(f"  Geocoded:  {geocoded}")
    print(f"  Failed:    {failed_geo}")
    print(f"  Skipped:   {skipped} (already had coordinates)")
    print(f"  Updated:   {updated}")
    print(f"  Server v:  {result.get('version', '?')}")


if __name__ == '__main__':
    main()
