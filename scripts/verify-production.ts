import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
const root: string = path.resolve(import.meta.dirname, '..');
const consumer: string = mkdtempSync(path.join(tmpdir(), 'knosys-production-'));
console.info('Isolated consumer: ' + consumer);
const packages: string = path.join(consumer, 'packages'); mkdirSync(packages, { recursive: true });
for (const directory of ['packages/sdk', 'apps/app-cli']) execFileSync('pnpm', ['pack', '--pack-destination', packages], { cwd: path.join(root, directory), stdio: 'inherit' });
writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, dependencies: { '@knosys/sdk': 'file:packages/knosys-sdk-0.1.0.tgz', ksio: 'file:packages/ksio-0.1.0.tgz' }, pnpm: { overrides: { '@knosys/sdk': 'file:packages/knosys-sdk-0.1.0.tgz' } } }, null, 2));
execFileSync('pnpm', ['install', '--prod', '--ignore-scripts', '--offline'], { cwd: consumer, stdio: 'inherit' });
writeFileSync(path.join(consumer, '.knosysrc'), JSON.stringify({ command: { synchronous: './sync.cjs', asynchronous: './async.cjs' } }));
writeFileSync(path.join(consumer, 'sync.cjs'), "exports.execute = value => { if(value !== 'passed') throw Error('sync argument missing'); console.log('sync passed'); };\n");
writeFileSync(path.join(consumer, 'async.cjs'), "exports.execute = async value => { await Promise.resolve(); if(value !== 'passed') throw Error('async argument missing'); console.log('async passed'); };\n");
writeFileSync(path.join(consumer, 'verify.cjs'), `const assert=require('assert');const {spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
(async()=>{for(const entry of ['@knosys/sdk','@knosys/sdk/app','@knosys/sdk/site','@knosys/sdk/site/generators/jekyll','@knosys/sdk/site/generators/hexo','@knosys/sdk/src/app','@knosys/sdk/src/site','@knosys/sdk/src/site/generators/jekyll','@knosys/sdk/src/site/generators/hexo']){const cjs=require(entry);const esm=await import(entry);assert.ok(Object.keys(cjs).length);assert.ok(Object.keys(esm).length);}
assert.equal(typeof require('@knosys/sdk/app').createStorage,'function');
const project=path.resolve('storage-'+process.versions.node);fs.mkdirSync(project,{recursive:true});const storage=require('@knosys/sdk/app').createStorage({appsRoot:path.resolve('apps-'+process.versions.node),allowedRoots:[project]});
await storage.initialize({mode:'create',projectRoot:project,sourceRelative:'data',appName:'test'});const collection=(await storage.getSnapshot('test')).collections[0].id;const record=await storage.createRecord('test',collection,{parameters:{slug:'a'},content:'first'});const updated=await storage.updateRecord('test',collection,record.id,{content:'second',expectedRevision:record.revision});assert.equal(updated.content,'second');await storage.deleteRecord('test',collection,record.id,updated.revision);assert.equal((await storage.getSnapshot('test')).collections[0].records.length,0);

fs.mkdirSync('documents/.meta',{recursive:true});fs.writeFileSync('documents/.meta/basic.yml','spec: file\\n');fs.writeFileSync('documents/index.md','# Generator title\\n\\nBody\\n');
for(const [name,fn,generated] of [['jekyll','generateJekyllData','_knosys'],['hexo','generateHexoData','source/knosys']]){const out=path.resolve('generated-'+name);fs.mkdirSync(out,{recursive:true});require('@knosys/sdk/site/generators/'+name)[fn](out,path.resolve('documents'),'default');assert.ok(fs.existsSync(path.join(out,generated,'default/index.md')));}

const cli=require.resolve('ksio').replace(/index.cjs$/,'bin.cjs');
for(const command of ['synchronous','asynchronous']){const result=spawnSync(process.execPath,[cli,command,'passed'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('passed'));}
assert.notEqual(spawnSync(process.execPath,[cli,'unknown'],{encoding:'utf8'}).status,0);
const web=spawnSync(process.execPath,[cli,'app','serve','--web-path','missing'],{encoding:'utf8'});assert.notEqual(web.status,0);assert.ok(web.stderr.includes(Number(process.versions.node.split('.')[0])<24?'requires Node.js 24':'Built Web server missing'));
console.log('Production consumer passed on Node '+process.versions.node);
})().catch(error=>{console.error(error);process.exitCode=1;});`);
for (const extension of ['mts', 'cts']) writeFileSync(path.join(consumer, 'types.' + extension), "import {createStorage} from '@knosys/sdk/app'; const create: typeof createStorage = createStorage; export {create};\n");
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--types', 'node', '--typeRoots', path.join(root, 'node_modules/@types'), 'types.mts', 'types.cts'], { cwd: consumer, stdio: 'inherit' });
console.info('SDK ESM and CJS consumer declarations passed');
execFileSync(process.execPath, ['verify.cjs'], { cwd: consumer, stdio: 'inherit' });
for (const version of ['14.0.0', '14.21.3']) execFileSync('docker', ['run', '--rm', '--network=none', '--memory=256m', '--cpus=1', '-v', consumer + ':/consumer', '-w', '/consumer', 'node:' + version, 'node', 'verify.cjs'], { stdio: 'inherit' });
