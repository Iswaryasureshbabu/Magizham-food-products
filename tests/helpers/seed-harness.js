const Module=require('module');const path=require('path');
function makeDb(initial){
  let st=JSON.parse(JSON.stringify(initial)),snap=null,nextCat=100;
  const client={async query(sql,p=[]){
    const s=sql.replace(/\s+/g,' ').trim();
    if(s==='BEGIN'){snap=JSON.stringify(st);return{rows:[]}}
    if(s==='COMMIT'){snap=null;return{rows:[]}}
    if(s==='ROLLBACK'){if(snap)st=JSON.parse(snap);return{rows:[]}}
    if(s.startsWith('INSERT INTO categories')){
      let c=st.cats.find(x=>x.slug===p[1]);const inserted=!c;
      if(!c){c={id:nextCat++,slug:p[1]};st.cats.push(c)}
      Object.assign(c,{name:p[0],active:p[5],order:p[6]});return{rows:[{id:c.id,inserted}]}}
    if(s.startsWith('SELECT id FROM products WHERE category_id')){
      const r=st.prods.find(x=>x.cat===p[0]&&x.slug===p[1]);return{rows:r?[{id:r.id}]:[]}}
    if(s.startsWith('SELECT p.id, p.product_name, c.category_slug')){
      const r=st.prods.find(x=>x.id===p[0]);if(!r)return{rows:[]};
      return{rows:[{id:r.id,product_name:r.name,category_slug:st.cats.find(c=>c.id===r.cat).slug}]}}
    if(s.startsWith('UPDATE products')){const r=st.prods.find(x=>x.id===p[9]);Object.assign(r,{name:p[0],slug:p[1],price:p[5]});return{rows:[{id:r.id}]}}
    if(s.startsWith('INSERT INTO products')){
      if(st.prods.find(x=>x.id===p[9]))throw Object.assign(new Error('dup'),{code:'23505'});
      st.prods.push({id:p[9],cat:p[10],name:p[0],slug:p[1],price:p[5],stock:p[11]});return{rows:[{id:p[9]}]}}
    if(s.startsWith('UPDATE categories SET is_active')){
      const keep=new Set(p);const out=st.cats.filter(c=>!keep.has(c.slug)&&c.active);out.forEach(c=>c.active=false);return{rows:out.map(c=>({category_slug:c.slug}))}}
    if(s.startsWith('SELECT setval'))return{rows:[]};
    if(s.includes('AS categories')){const act=st.cats.filter(c=>c.active);return{rows:[{categories:act.length,products:st.prods.filter(x=>act.some(c=>c.id===x.cat)).length}]}}
    throw new Error('UNMOCKED SQL: '+s.slice(0,80));
  },release(){}};
  return{client,get:()=>st};
}
const scenario=process.argv[2];
const init={
 fresh:{cats:[],prods:[]},
 twice:{cats:[],prods:[]},
 legacy:{cats:[{id:1,slug:'millets',active:true},{id:2,slug:'pickles',active:true}],
   prods:[{id:5,cat:1,name:'Ragi',slug:'ragi',price:50,stock:7},{id:30,cat:2,name:'Tomato Pickle',slug:'tomato-pickle',price:60,stock:12}]},
 legacyok:{cats:[{id:1,slug:'millets',active:true},{id:2,slug:'pickles',active:true}],
   prods:[{id:100,cat:1,name:'Ragi',slug:'ragi',price:50,stock:7},{id:30,cat:2,name:'Tomato Pickle',slug:'tomato-pickle',price:60,stock:12}]}
}[scenario];
const db=makeDb(init);
const origLoad=Module._load;
Module._load=function(req,...a){ if(req==='../config/db')return{pool:{connect:async()=>db.client,end:async()=>{}}}; return origLoad.call(this,req,...a)};
process.argv=[process.argv[0],'seed.js',...process.argv.slice(3)];
process.on('exit',c=>{const st=db.get();const act=st.cats.filter(x=>x.active).length;
 console.log(`RESULT scenario=${scenario} exit=${c||0} products_in_db=${st.prods.length} active_cats=${act} tomato30=${JSON.stringify(st.prods.find(x=>x.id===30)||null)}`)});
const seedFile=path.resolve(__dirname,'..','..','server','db','seed.js');
if(scenario==='twice'){            // run the seed two times against the same database
  require(seedFile);
  setTimeout(()=>{ delete require.cache[seedFile]; process.exitCode=0; require(seedFile); },600);
}else{ require(seedFile); }
