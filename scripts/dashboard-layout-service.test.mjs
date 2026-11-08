import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLayoutService} from './dashboard-layout-service.mjs';

test('only authenticated editors can save, stale revisions never overwrite, readers see persisted layout', async () => {
  const dir=await mkdtemp(join(tmpdir(),'design-layout-')), service=createServer(createLayoutService(dir,true));
  await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+service.address().port+'/dashboard-layout';
  try {
    const auth='Bearer '+await readFile(join(dir,'admin-token'),'utf8');
    const write=(headers={},columns=2)=>fetch(url,{method:'PUT',headers:{'content-type':'application/json',...headers},body:JSON.stringify({view:'housing',columns,revision:0})});
    assert.equal((await write()).status,403);assert.equal((await write({authorization:auth,origin:'https://unrelated.invalid'})).status,403);
    assert.equal((await write({authorization:auth},5)).status,400);
    const receipts=await Promise.all([write({authorization:auth}),write({authorization:auth})]);assert.deepEqual(receipts.map(r=>r.status).sort(),[200,409]);
    assert.deepEqual(await (await fetch(url)).json(),{revision:1,columns:{housing:2},authoring:true});
    assert.deepEqual(JSON.parse(await readFile(join(dir,'layout.json'),'utf8')),{revision:1,columns:{housing:2}});
    const reset=await fetch(url,{method:'PUT',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({view:'housing',columns:null,revision:1})});
    assert.deepEqual(await reset.json(),{revision:2,columns:{}});
  } finally {await new Promise(resolve=>service.close(resolve));await rm(dir,{recursive:true});}
});
