"""Static dev server with caching disabled (so edited ES modules always reload)."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5188
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
