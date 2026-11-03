// Fixed loopback origin keeps browser storage stable. No external dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end('Bad request');}
  const filename=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
  const relative=path.relative(ROOT,filename);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!['.html','.js','.css','.jpg','.png','.svg','.ico'].includes(path.extname(filename))){res.writeHead(404);return res.end('Not found');}
  fs.stat(filename,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    if(req.method==='HEAD')return res.end();
    const stream=fs.createReadStream(filename);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port 4173 is in use. If this app is already running, open http://127.0.0.1:4173 .':err.message);process.exitCode=1;});
server.listen(4173,'127.0.0.1',()=>console.log('Jianwei is ready: http://127.0.0.1:4173\nPress Ctrl+C to stop.'));
