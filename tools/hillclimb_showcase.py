#!/usr/bin/env python3
"""Render hi-res feature images for Hill Climb Racer straight from the game's own painters.
Usage: python3 tools/hillclimb_showcase.py [outdir]     (needs: pip install playwright, and a Chrome/Chromium)
  env CHROME=/path/to/chrome   (default /usr/bin/google-chrome)
Cars + obstacles -> transparent PNGs.  Bridges -> 3200x1600 frames from the live game with the HUD hidden."""
import os, sys, threading, http.server
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'hillclimb', 'phase1')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
os.makedirs(OUT, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_GET(s):
        if s.path.startswith('/__stage'):
            body = STAGE.encode(); s.send_response(200); s.send_header('Content-Type', 'text/html'); s.send_header('Content-Length', str(len(body))); s.end_headers(); s.wfile.write(body)
        else: super().do_GET()
STAGE = """<!doctype html><meta charset=utf-8><body style="margin:0;background:transparent">
<canvas id=c></canvas>
<script>const S={skin:[],accOn:[],accOwn:[],drv:0,outfit:0,own:[]},IM={};</script>
<script src="/games/hillclimb-racing/veh.js"></script><script src="/games/hillclimb-racing/cars.js"></script>
<script>
fetch('/games/hillclimb-racing/props.js').then(r=>r.text()).then(t=>{const s=document.createElement('script');s.text=t.replace('const k=2','const k=6');document.head.appendChild(s);
 const w=new Image();w.onload=()=>{IM.wheel=w;document.title='ready'};w.src='/games/hillclimb-racing/a/wheel.png'});
function car(vi,W,H,sc){const c=document.getElementById('c');c.width=W;c.height=H;const g=c.getContext('2d');g.clearRect(0,0,W,H);
 g.save();g.translate(W/2,H*.62);g.scale(sc,sc);g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(0,VEH[vi].wh[0].y+VEH[vi].R+2,120,7,0,0,7);g.fill();drawVeh(g,vi,{t:1});g.restore()}
function prop(k,pad){const a=PA[k],c=document.getElementById('c');c.width=a.width+pad*2;c.height=a.height+pad*2;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.drawImage(a,pad,pad)}
</script>"""
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8769), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
B = 'http://127.0.0.1:8769'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1800, 'height': 1200}); pg.goto(B + '/__stage'); pg.wait_for_function("document.title=='ready'")
    for vi, name in [(4, 'car_lightning_gt'), (5, 'car_dune_hauler'), (6, 'car_patrol_cruiser'), (7, 'car_crimson_crusher')]:
        pg.evaluate(f"car({vi},1800,1200,5.4)"); pg.locator('#c').screenshot(path=f'{OUT}/{name}.png', omit_background=True); print('wrote', name)
    for k in ['tires', 'rockpile', 'barrier', 'barricade', 'hay', 'sandbags']:
        pg.evaluate(f"prop('{k}',40)"); pg.locator('#c').screenshot(path=f'{OUT}/obstacle_{k}.png', omit_background=True); print('wrote obstacle', k)
    pg.close()
    JS = """([w])=>{S.veh=0;let f=null;for(let l=0;l<5&&!f;l++){start(w,l);f=LV.gorges.find(q=>q.type==='gorge')}
      const mx=(f.a+f.b)/2;car.x=mx;car.y=Hf(mx)-90;car.a=0;car.vx=car.vy=0;paused=true;cam={x:mx,y:Hf(mx)-40};
      document.getElementById('hud').classList.add('hide');for(let i=0;i<3;i++)drawScene()}"""
    for w, name in [(0, 'bridge_stone_arch_green_hills'), (1, 'bridge_timber_trestle_desert'), (2, 'bridge_snow_stone_arch'), (3, 'bridge_steel_truss_night')]:
        g = b.new_page(viewport={'width': 1600, 'height': 800}, device_scale_factor=2); g.goto(B + '/games/hillclimb-racing/'); g.wait_for_timeout(2500)
        g.evaluate(JS, [w]); g.wait_for_timeout(300); g.evaluate("()=>{for(let i=0;i<3;i++)drawScene()}"); g.screenshot(path=f'{OUT}/{name}.jpg',type='jpeg',quality=90); print('wrote', name); g.close()
    b.close()
