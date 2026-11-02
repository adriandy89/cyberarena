"""Race condition lab: TOCTOU, double-spend, limit bypass — Python stdlib."""
import os
import json
import time
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

lock = threading.Lock()

# Sequential requests get 429'd at max_purchases + IN_FLIGHT_GRACE; only
# parallel requests inside the race window can land past that line.
IN_FLIGHT_GRACE = 10

# Shared mutable state (the vulnerability)
state = {
    'balance': 100,
    'coupon_uses': {},
    'coupons': {'WELCOME10': {'value': 10, 'max_uses': 1}, 'MEGA50': {'value': 50, 'max_uses': 1}},
    'purchases': 0,
    'max_purchases': 3,
    'achievements': set(),
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/status':
            self.send_json({k: v for k, v in state.items() if k != 'achievements'})
        elif path == '/redeem':
            self.handle_redeem(params)
        elif path == '/redeem-safe':
            self.handle_redeem_safe(params)
        elif path == '/buy':
            self.handle_buy(params)
        elif path == '/buy-safe':
            self.handle_buy_safe(params)
        elif path == '/checkout':
            self.handle_checkout(params)
        elif path == '/checkout-safe':
            self.handle_checkout_safe(params)
        elif path == '/achievements':
            self.handle_achievements()
        elif path == '/reset':
            self.handle_reset()
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_reset(self):
        """Resets state so the student can retry the race from scratch."""
        with lock:
            state['balance'] = 100
            state['coupon_uses'] = {}
            state['purchases'] = 0
            state['achievements'] = set()
        self.send_json({'status': 'reset', 'note': 'state restored to initial values'})

    def handle_redeem(self, params):
        """VULNERABLE: check-then-act without lock."""
        code = params.get('code', [''])[0]
        coupon = state['coupons'].get(code)
        if not coupon:
            self.send_json({'error': 'invalid coupon'}, 400)
            return

        # CHECK (no lock)
        uses = state['coupon_uses'].get(code, 0)
        if uses >= coupon['max_uses']:
            self.send_json({'error': 'coupon already used', 'uses': uses}, 409)
            return

        # TIME GAP — attacker sends 20 parallel requests here
        time.sleep(0.1)  # simulate slow database lookup

        # ACT (no lock — multiple threads can reach here simultaneously)
        state['coupon_uses'][code] = state['coupon_uses'].get(code, 0) + 1
        state['balance'] += coupon['value']

        uses = state['coupon_uses'][code]
        if uses > 1:
            state['achievements'].add('double_spend')
            self.send_json({
                'status': 'redeemed', 'balance': state['balance'],
                'uses': uses, 'achievement': 'DOUBLE_SPEND!',
                'flag': FLAG_1 if uses >= 5 else None,
            })
        else:
            self.send_json({'status': 'redeemed', 'balance': state['balance'], 'uses': uses})

    def handle_redeem_safe(self, params):
        """PATCHED: with lock (for comparison)."""
        code = params.get('code', [''])[0]
        coupon = state['coupons'].get(code)
        if not coupon:
            self.send_json({'error': 'invalid coupon'}, 400)
            return

        with lock:
            uses = state['coupon_uses'].get(code, 0)
            if uses >= coupon['max_uses']:
                self.send_json({'error': 'coupon already used (safe)', 'uses': uses}, 409)
                return
            state['coupon_uses'][code] = uses + 1
            state['balance'] += coupon['value']
            self.send_json({'status': 'redeemed (safe)', 'balance': state['balance'], 'uses': uses + 1})

    def handle_buy(self, params):
        """VULNERABLE: daily purchase limit — check-then-act without lock.

        Sequential requests can never exceed max_purchases + IN_FLIGHT_GRACE,
        but parallel requests in the race window overshoot past it.
        """
        # CHECK (no lock)
        if state['purchases'] >= state['max_purchases']:
            time.sleep(0.05)  # slow "policy lookup" — the race window
            if state['purchases'] >= state['max_purchases'] + IN_FLIGHT_GRACE:
                self.send_json({'error': 'daily limit reached', 'purchases': state['purchases']}, 429)
                return

        time.sleep(0.1)  # ACT delay — parallel threads pile up here
        # ACT (no lock)
        state['purchases'] += 1
        state['balance'] -= 5

        # Sequentially unreachable: the hard 429 gate stops at max+grace,
        # only in-flight parallel threads can land past it.
        if state['purchases'] > state['max_purchases'] + IN_FLIGHT_GRACE:
            state['achievements'].add('limit_bypass')
            self.send_json({
                'status': 'purchased', 'balance': state['balance'],
                'achievement': 'LIMIT_BYPASS!', 'flag': FLAG_2,
                'purchases': state['purchases'], 'max': state['max_purchases'],
            })
        elif state['purchases'] > state['max_purchases']:
            self.send_json({
                'status': 'purchased', 'balance': state['balance'],
                'purchases': state['purchases'], 'note': 'over the limit already — keep pushing in PARALLEL',
            })
        else:
            self.send_json({'status': 'purchased', 'balance': state['balance'], 'purchases': state['purchases']})

    def handle_buy_safe(self, params):
        """PATCHED: with lock."""
        with lock:
            if state['purchases'] >= state['max_purchases']:
                self.send_json({'error': 'daily limit reached (safe)'}, 429)
                return
            state['purchases'] += 1
            state['balance'] -= 5
            self.send_json({'status': 'purchased (safe)', 'balance': state['balance']})

    def handle_checkout(self, params):
        """VULNERABLE: balance check suffers TOCTOU.

        Sequentially the balance can reach 0 but NEVER below: every request
        re-checks balance >= price before decrementing. Parallel requests
        all pass the check on the same stale balance and then all decrement.
        """
        price = 5
        # CHECK (no lock) — sequential calls always see the fresh balance
        if state['balance'] < price:
            self.send_json({'error': 'insufficient balance', 'balance': state['balance']}, 402)
            return

        time.sleep(0.2)  # "payment gateway" delay — the race window
        # ACT (no lock)
        state['balance'] -= price

        if state['balance'] < 0:
            state['achievements'].add('negative_balance')
            self.send_json({
                'status': 'paid', 'balance': state['balance'],
                'achievement': 'NEGATIVE_BALANCE!', 'flag': FLAG_3,
            })
        else:
            self.send_json({'status': 'paid', 'balance': state['balance']})

    def handle_checkout_safe(self, params):
        """PATCHED: with lock."""
        price = 5
        with lock:
            if state['balance'] < price:
                self.send_json({'error': 'insufficient balance (safe)', 'balance': state['balance']}, 402)
                return
            state['balance'] -= price
            self.send_json({'status': 'paid (safe)', 'balance': state['balance']})

    def handle_achievements(self):
        achievements = sorted(state['achievements'])
        self.send_json({
            'achievements': achievements,
            'hints': {
                'double_spend': 'Send 10+ PARALLEL requests to /redeem?code=WELCOME10',
                'limit_bypass': 'Send 25+ PARALLEL requests to /buy (sequential will not work)',
                'negative_balance': 'Send 30+ PARALLEL requests to /checkout with balance at 100',
            },
        })

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>RaceLab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🏁 RaceLab — Coupon System</h1>
<p>Redeem coupons and buy items. But can you exploit the race conditions?</p>
<ul>
<li><a href="/status" style="color:#58a6ff">/status</a> — Your balance and stats</li>
<li><a href="/redeem?code=WELCOME10" style="color:#58a6ff">/redeem?code=WELCOME10</a> — Redeem coupon (VULNERABLE)</li>
<li><a href="/redeem-safe?code=MEGA50" style="color:#58a6ff">/redeem-safe?code=MEGA50</a> — Redeem (SAFE for comparison)</li>
<li><a href="/buy" style="color:#58a6ff">/buy</a> — Buy item (VULNERABLE, max 3/day)</li>
<li><a href="/checkout" style="color:#58a6ff">/checkout</a> — Pay via gateway (VULNERABLE balance check)</li>
<li><a href="/achievements" style="color:#58a6ff">/achievements</a> — View unlocked achievements</li>
<li><a href="/reset" style="color:#58a6ff">/reset</a> — Reset state to retry</li>
</ul>
<p style="color:#d29922;font-size:12px">Try: for i in $(seq 1 20); do curl "http://127.0.0.1:18099/redeem?code=WELCOME10" & done; wait</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Race condition lab on :8080')
    server.serve_forever()
