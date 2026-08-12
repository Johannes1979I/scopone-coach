#!/usr/bin/env python3
"""Server locale per Scopone Coach.

Serve i file statici e accetta POST /log per scrivere il resoconto di ogni
mano in logs/, cosi' l'analisi puo' leggerlo direttamente dal disco.

    /Library/Developer/CommandLineTools/usr/bin/python3 server.py
"""

import datetime
import http.server
import json
import os
import re
import socketserver

BASE = os.path.dirname(os.path.abspath(__file__))
LOGS = os.path.join(BASE, 'logs')
PORT = int(os.environ.get('PORT', '8103'))


class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def do_POST(self):
        if self.path.rstrip('/') not in ('/log', 'log'):
            self.send_error(404)
            return

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > 4_000_000:
            self.send_error(400, 'corpo mancante o troppo grande')
            return

        try:
            dati = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self.send_error(400, 'json non valido')
            return

        os.makedirs(LOGS, exist_ok=True)
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        mano = re.sub(r'\W', '', str(dati.get('mano', '0')))[:4] or '0'
        nome = '%s-mano%s.json' % (stamp, mano)

        with open(os.path.join(LOGS, nome), 'w', encoding='utf-8') as f:
            json.dump(dati, f, ensure_ascii=False, indent=1)

        corpo = json.dumps({'ok': True, 'file': nome}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, fmt, *args):
        if self.command == 'POST':
            print('log salvato: %s' % (args[0] if args else ''))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    os.makedirs(LOGS, exist_ok=True)
    with Server(('127.0.0.1', PORT), Handler) as srv:
        print('Scopone Coach su http://localhost:%d' % PORT)
        print('log in %s' % LOGS)
        srv.serve_forever()
