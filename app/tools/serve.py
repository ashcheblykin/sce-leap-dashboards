#!/usr/bin/env python3
"""Dev server for the app/ directory.

`python3 -m http.server` sends no Cache-Control, only Last-Modified/ETag, so
Chrome falls back to heuristic freshness and keeps serving an edited CSS file
from cache — even through a hard reload — until the heuristic window expires.
This is the same static server with `Cache-Control: no-store` on every
response, so an edit is always one reload away.

Usage: python3 tools/serve.py [port]   (default 8123, run from app/)
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    # Last-Modified alone is enough to trigger a 304 on a conditional request,
    # which would hand back the stale body we just refused to cache.
    def send_header(self, keyword, value):
        if keyword.lower() in ('last-modified', 'etag'):
            return
        super().send_header(keyword, value)

    # A browser that cached the file before this server existed still sends the
    # old validators; drop them so it always gets a fresh 200, never a 304.
    def send_head(self):
        for h in ('If-Modified-Since', 'If-None-Match'):
            while h in self.headers:
                del self.headers[h]
        return super().send_head()


def main(port=8123, directory='.'):
    handler = partial(NoCacheHandler, directory=directory)
    print(f'serving {directory} on http://localhost:{port} (no-store)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 8123,
         sys.argv[2] if len(sys.argv) > 2 else '.')
