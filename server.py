"""
BOB Sales Tracker - Sync Server
Run this to serve the app AND sync data between devices on your local network.

Usage:
  python server.py

Then open http://<your-ip>:9090 on any device on your WiFi.
"""
import http.server
import json
import os
import threading
import time
from urllib.parse import urlparse

PORT = int(os.environ.get('PORT', 9090))
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'sync-data.json')

# Lock for thread-safe file access
file_lock = threading.Lock()


def read_sync_data():
    """Read the current synced data from disk."""
    with file_lock:
        if not os.path.exists(DATA_FILE):
            return {"accounts": [], "activities": [], "pipeline": [], "sales": [], "routes": [], "version": 0}
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"accounts": [], "activities": [], "pipeline": [], "sales": [], "routes": [], "version": 0}


def write_sync_data(data):
    """Write synced data to disk."""
    with file_lock:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


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
            self.send_json({"status": "ok", "time": time.time()})
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
