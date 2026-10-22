# Servidor local sem cache: o navegador sempre baixa a versão atual dos arquivos.
# POST /fps-log  → acrescenta uma linha em fps-log.txt (quedas de fps registradas pelo app).
# POST /settings → grava dist/settings.json (botão Salvar do app; carregado ao abrir a página).
import http.server,functools,sys,json,time,os
ROOT=os.path.dirname(os.path.abspath(__file__));LOG=os.path.join(ROOT,'fps-log.txt');SETTINGS=os.path.join(ROOT,'dist','settings.json')
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store, must-revalidate');self.send_header('Expires','0');super().end_headers()
    def log_message(self,*a):pass
    def do_POST(self):
        n=int(self.headers.get('Content-Length') or 0);raw=self.rfile.read(min(n,262144))
        try:d=json.loads(raw)
        except Exception:self.send_response(400);self.end_headers();return
        if self.path=='/fps-log':
            with open(LOG,'a') as f:f.write(time.strftime('%Y-%m-%d %H:%M:%S')+' '+json.dumps(d,ensure_ascii=False)+'\n')
        elif self.path=='/settings':
            tmp=SETTINGS+'.tmp'
            with open(tmp,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1)
            os.replace(tmp,SETTINGS)
        else:self.send_response(404);self.end_headers();return
        self.send_response(204);self.end_headers()
port=int(sys.argv[1]) if len(sys.argv)>1 else 4173
http.server.ThreadingHTTPServer(('',port),functools.partial(H,directory=os.path.join(ROOT,'dist'))).serve_forever()
