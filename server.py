"""
BOB Sales Tracker - Sync Server
Run this to serve the app AND sync data between devices on your local network.

Usage:
  python server.py

Then open http://<your-ip>:9090 on any device on your WiFi.
"""
import base64
import http.server
import json
import os
import threading
import time
import urllib.request as urlreq
from urllib.parse import urlparse

PORT = int(os.environ.get('PORT', 9090))
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'sync-data.json')

# Public GitHub Gist for persistent backup (survives Render restarts)
# Public gist = no auth needed to READ. Writing needs GITHUB_TOKEN env var (optional).
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GIST_ID = 'be770fd55e24671ca3e5830636ab3689'

# Lock for thread-safe file access
file_lock = threading.Lock()

# --- GitHub Gist Backup ---

def gist_load():
    """Load sync data from public GitHub Gist (no auth needed)."""
    try:
        req = urlreq.Request(
            f'https://api.github.com/gists/{GIST_ID}',
            headers={'Accept': 'application/vnd.github.v3+json'}
        )
        resp = urlreq.urlopen(req, timeout=15)
        gist = json.loads(resp.read())
        content = gist.get('files', {}).get('sync-data.json', {}).get('content', '{}')
        data = json.loads(content)
        if data.get('version', 0) > 0:
            print(f'  Restored from GitHub backup: v{data["version"]}, '
                  f'{sum(len(data.get(c, [])) for c in ["accounts","activities","pipeline","sales","routes"])} records')
            return data
        return None
    except Exception as e:
        print(f'  GitHub backup load failed: {e}')
        return None


_gist_save_timer = None

def gist_save(data):
    """Save sync data to GitHub Gist (debounced). Needs GITHUB_TOKEN env var for writes."""
    global _gist_save_timer
    if not GITHUB_TOKEN:
        return

    def do_save():
        try:
            payload = json.dumps({
                'files': {
                    'sync-data.json': {
                        'content': json.dumps(data, ensure_ascii=False)
                    }
                }
            }).encode('utf-8')
            req = urlreq.Request(
                f'https://api.github.com/gists/{GIST_ID}',
                data=payload,
                headers={
                    'Authorization': f'token {GITHUB_TOKEN}',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                method='PATCH'
            )
            urlreq.urlopen(req, timeout=15)
            print(f'  GitHub backup saved: v{data.get("version", 0)}')
        except Exception as e:
            print(f'  GitHub backup save failed: {e}')

    # Debounce: save at most every 10 seconds
    if _gist_save_timer:
        _gist_save_timer.cancel()
    _gist_save_timer = threading.Timer(10.0, do_save)
    _gist_save_timer.daemon = True
    _gist_save_timer.start()


# --- Local Data Storage ---

EMPTY_DATA = {"accounts": [], "activities": [], "pipeline": [], "sales": [], "routes": [], "version": 0}

def read_sync_data():
    """Read sync data from disk, falling back to GitHub backup."""
    with file_lock:
        if not os.path.exists(DATA_FILE):
            # Local file missing (Render restart?) — try GitHub backup
            backup = gist_load()
            if backup:
                os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(backup, f, indent=2, ensure_ascii=False)
                return backup
            return {**EMPTY_DATA}
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {**EMPTY_DATA}


def write_sync_data(data):
    """Write synced data to disk AND trigger GitHub backup."""
    with file_lock:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    # Also back up to GitHub (debounced)
    gist_save(data)


def merge_collection(server_items, client_items):
    """Merge two collections using 'last write wins' by updatedAt timestamp.
    Also handles new items from either side and deletions."""
    merged = {}

    # Index server items by ID
    for item in server_items:
        if item.get('id'):
            merged[item['id']] = item

    # Merge client items - client wins if newer
    for item in client_items:
        item_id = item.get('id')
        if not item_id:
            continue
        if item_id not in merged:
            # New item from client
            merged[item_id] = item
        else:
            # Compare timestamps - newer wins
            server_time = merged[item_id].get('updatedAt', '')
            client_time = item.get('updatedAt', '')
            if client_time >= server_time:
                merged[item_id] = item

    return list(merged.values())


class SyncHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler that serves static files AND handles sync API."""

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/sync':
            # Return current server data + version
            data = read_sync_data()
            self.send_json(data)
        elif parsed.path == '/api/ping':
            self.send_json({
                "status": "ok",
                "time": time.time(),
                "backup": "configured" if GITHUB_TOKEN else "not configured",
            })
        elif parsed.path == '/api/force-update':
            # Returns a small HTML page that clears ALL service worker caches
            # and reloads the app fresh. Since /api/ routes bypass the SW cache,
            # this page is always served fresh from the network.
            html = """<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Updating BOB Sales...</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;
min-height:100vh;margin:0;background:#1a1a2e;color:#f0a500;text-align:center}
.box{padding:2rem}h2{margin-bottom:1rem}#status{color:#ccc;margin-top:1rem}</style></head>
<body><div class="box"><h2>Updating BOB Sales...</h2>
<p id="status">Clearing old cache...</p></div>
<script>
(async function(){
  const s = document.getElementById('status');
  try {
    // Unregister all service workers
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) { await r.unregister(); }
    s.textContent = 'Service worker removed...';

    // Delete all caches
    const keys = await caches.keys();
    for (const k of keys) { await caches.delete(k); }
    s.textContent = 'Cache cleared! Reloading...';

    // Small delay then redirect to app root
    setTimeout(() => { window.location.href = '/'; }, 1000);
  } catch(e) {
    s.textContent = 'Error: ' + e.message + '. Try clearing Safari data manually.';
  }
})();
</script></body></html>"""
            response = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', len(response))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(response)
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/sync':
            # Read client data
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                client_data = json.loads(body)
            except:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            # Read current server data
            server_data = read_sync_data()

            # Merge each collection
            collections = ['accounts', 'activities', 'pipeline', 'sales', 'routes']
            for col in collections:
                server_items = server_data.get(col, [])
                client_items = client_data.get(col, [])
                server_data[col] = merge_collection(server_items, client_items)

            # Bump version
            server_data['version'] = server_data.get('version', 0) + 1
            server_data['lastSyncAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')

            # Save merged data
            write_sync_data(server_data)

            # Return merged data to client
            self.send_json(server_data)
            print(f"  Sync: {sum(len(server_data.get(c, [])) for c in collections)} total records, v{server_data['version']}")
        else:
            self.send_error(404)

    def send_json(self, data, code=200):
        response = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(response))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(response)

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        # Only log non-static requests or errors
        msg = format % args
        if '/api/' in msg or '404' in msg or '500' in msg:
            print(f"  {msg}")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Get local IP for display
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "localhost"

    server = http.server.HTTPServer(('0.0.0.0', PORT), SyncHandler)
    print(f"\n{'='*50}")
    print(f"  BOB Sales Tracker - Sync Server")
    print(f"{'='*50}")
    print(f"  Local:   http://localhost:{PORT}")
    print(f"  Network: http://{local_ip}:{PORT}")
    print(f"  Data:    {DATA_FILE}")
    print(f"{'='*50}")
    print(f"  Open the URL above on your phone or PC.")
    print(f"  Data syncs automatically between devices.")
    print(f"  Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == '__main__':
    main()
