"""Offline single-machine test server. Intentionally binds loopback only."""
import http.server, json, sqlite3, pathlib, zipfile, io, uuid, datetime, argparse, os
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'local-data'
DATA.mkdir(exist_ok=True)
def db():
 c=sqlite3.connect(DATA/'projects.sqlite3');c.execute('CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT,updated TEXT,path TEXT)');return c
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'dist'),**kw)
 def answer(self,status,data):
  body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def valid_host(self):return self.headers.get('Host','').split(':')[0] in ('localhost','127.0.0.1')
 def do_GET(self):
  if not self.valid_host():return self.answer(403,{'error':'invalid host'})
  if self.path=='/api/health':return self.answer(200,{'service':'drawing-desk-local'})
  if self.path=='/api/projects':
   with db() as c: rows=c.execute('SELECT id,name,updated FROM projects ORDER BY updated DESC').fetchall()
   return self.answer(200,[dict(zip(('id','name','updated'),r)) for r in rows])
  if self.path.startswith('/api/projects/'):
   from urllib.parse import unquote
   with db() as c:r=c.execute('SELECT path FROM projects WHERE id=?',(unquote(self.path[14:]),)).fetchone()
   if not r:return self.answer(404,{'error':'missing'})
   data=(DATA/r[0]).read_bytes();self.send_response(200);self.send_header('Content-Type','application/zip');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if self.path.startswith('/api/'):return self.answer(404,{'error':'missing'})
  return super().do_GET()
 def do_PUT(self):
  if not self.valid_host() or self.headers.get('Sec-Fetch-Site')=='cross-site':return self.answer(403,{'error':'forbidden'})
  origin=self.headers.get('Origin')
  if origin and origin!='http://'+self.headers.get('Host'):return self.answer(403,{'error':'origin'})
  if not self.path.startswith('/api/projects/'):return self.answer(404,{'error':'missing'})
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=1024**3:return self.answer(413,{'error':'size'})
   data=self.rfile.read(size)
   with zipfile.ZipFile(io.BytesIO(data)) as z:
    info=z.getinfo('project.json')
    if info.file_size>50*1024**2:raise ValueError('manifest too large')
    m=json.loads(z.read(info))
    if m.get('format')!='drawing-desk-project' or m.get('version')!=1:raise ValueError('invalid format')
   from urllib.parse import unquote
   key=unquote(self.path[14:]);name=str(m['case']['name']);stamp=datetime.datetime.now().astimezone().isoformat(timespec='seconds')
   filename=str(uuid.uuid4())+'.drawing.zip';tmp=DATA/(filename+'.tmp');tmp.write_bytes(data);os.replace(tmp,DATA/filename)
   with db() as c:c.execute('INSERT OR REPLACE INTO projects VALUES(?,?,?,?)',(key,name,stamp,filename))
   return self.answer(200,{'saved':True})
  except Exception as e:return self.answer(400,{'error':str(e)})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);a=p.parse_args();print(f'Open http://127.0.0.1:{a.port} — local-only testing',flush=True);http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
