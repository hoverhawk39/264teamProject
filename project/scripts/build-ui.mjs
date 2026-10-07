import {build} from 'esbuild';
await build({entryPoints:['src/ui/main.jsx'],outfile:'dist/antd-ui.js',bundle:true,minify:true,format:'iife',target:['es2022'],define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
// Keep complete upstream license text alongside the offline bundle.
const {execFileSync}=await import('node:child_process');
const {readFileSync,existsSync,writeFileSync}=await import('node:fs');
const {join}=await import('node:path');
const paths=execFileSync('npm',['ls','--omit=dev','--parseable','--all'],{encoding:'utf8'}).trim().split('\n').slice(1);
const notices=[];
for(const path of [...new Set(paths)]){
 const pkg=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));
 const file=['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','LICENCE'].find(name=>existsSync(join(path,name)));
 notices.push(`${pkg.name}@${pkg.version} — ${pkg.license||'see package'}\n${file?readFileSync(join(path,file),'utf8').replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,''):'See upstream package license.'}`);
}
writeFileSync('dist/THIRD_PARTY_UI_LICENSES.txt',notices.join('\n\n--------------------\n\n'));
