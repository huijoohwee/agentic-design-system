// Optional loopback authoring for site layout records, separate from the read-only token registry.
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isLayoutKey, isColumnCount, isColumnLayout } from '../site/dashboard-columns.js';

const digest = text => createHash('sha256').update(text).digest();
export function createLayoutService(directory, enabled) {
  const credential = join(directory, 'admin-token'), record = join(directory, 'layout.json'), lock = join(directory, 'save.lock');
  // Dev permissions are tied to the OS account. Never print or serve the credential.
  if (enabled) {
    mkdirSync(directory, {recursive:true, mode:0o700});
    try { writeFileSync(credential, randomBytes(32).toString('hex'), {flag:'wx', mode:0o600}); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  const read = () => {
    let layout;
    try { layout = JSON.parse(readFileSync(record, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; layout = { revision:0, columns:{} }; }
    if (!isColumnLayout(layout)) throw Error('Invalid stored layout');
    return layout;
  };
  return async (req, res) => {
    const send = (status, data) => res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}).end(JSON.stringify(data));
    if (req.headers.origin && req.headers.origin !== 'http://'+req.headers.host) return send(403,{error:'origin_refused'});
    try {
      if (req.method === 'GET' && req.url === '/dashboard-layout') return send(200,{...read(), authoring:enabled});
      if (!(req.method === 'POST' && req.url === '/dashboard-layout/session' || req.method === 'PUT' && req.url === '/dashboard-layout')) return send(405,{error:'method_refused'});
      const token = enabled && readFileSync(credential,'utf8').trim();
      if (!token || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(digest(req.headers.authorization || ''),digest('Bearer '+token))) return send(403,{error:'admin_required'});
      if (req.method === 'POST') return send(200,read());
      if (req.headers['content-type'] !== 'application/json') return send(415,{error:'json_required'});
      const chunks=[]; let length=0;
      for await (const chunk of req) { length+=chunk.length; if(length>512) return send(413,{error:'too_large'}); chunks.push(chunk); }
      let input; try {input=JSON.parse(Buffer.concat(chunks).toString());} catch {return send(400,{error:'invalid_layout'});}
      if (!input || Object.keys(input).sort().join()!=='columns,revision,view' || !isLayoutKey(input.view) || !isColumnCount(input.columns) || !Number.isSafeInteger(input.revision)) return send(400,{error:'invalid_layout'});
      let fd; try {fd=openSync(lock,'wx',0o600);} catch(e){if(e.code==='EEXIST')return send(409,{error:'layout_busy'});throw e;}
      try {
        const layout=read(); if(layout.revision!==input.revision)return send(409,{error:'stale_revision'});
        const next={revision:layout.revision+1,columns:{...layout.columns,[input.view]:input.columns}};
        if(!isColumnLayout(next))return send(400,{error:'layout_limit'});
        writeFileSync(record+'.tmp', JSON.stringify(next), {mode:0o600}); renameSync(record+'.tmp',record);
        return send(200,next);
      } finally {closeSync(fd); unlinkSync(lock);}
    } catch {return send(503,{error:'layout_unavailable'});}
  };
}
