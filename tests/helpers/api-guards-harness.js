process.env.DATABASE_URL='postgresql://x:y@127.0.0.1:1/none';
process.env.SESSION_SECRET='test-secret-test-secret-test-secret-123456';
process.env.NODE_ENV='test';
const Module=require('module'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
// ---- stand-in database ------------------------------------------------
const db={
 users:{1:{id:1,name:'Cust',email:'c@x.in',role:'user'},2:{id:2,name:'Adm',email:'a@x.in',role:'admin'}},
 cats:{1:{id:1,is_active:true,category_slug:'podi'},2:{id:2,is_active:false,category_slug:'millets'}},
 prods:{10:{id:10,category_id:1,stock_quantity:5,is_available:true,image_url:'images/idli-podi.jpg',product_name:'Idli',product_slug:'idli',price:45},
        20:{id:20,category_id:2,stock_quantity:5,is_available:true,image_url:'images/ragi.jpg',product_name:'Ragi',product_slug:'ragi',price:50}},
 orders:{1:{id:1,order_status:'cancelled'},2:{id:2,order_status:'pending'}},
 items:{2:[{product_id:10,quantity:2}]}, log:[]
};
const full=p=>({...p,category_slug:db.cats[p.category_id].category_slug,category_name:'c',category_name_ta:null,description:null,description_ta:null,weight:'100g',created_at:new Date(),updated_at:new Date()});
async function q(sql,p=[]){
 const s=sql.replace(/\s+/g,' ').trim();
 if(s.startsWith('SELECT id, name, email, role, created_at FROM users'))return{rows:[db.users[p[0]]].filter(Boolean)};
 if(s.startsWith('SELECT id, is_active FROM categories'))return{rows:[db.cats[p[0]]].filter(Boolean)};
 if(s==='SELECT * FROM products WHERE id = $1')return{rows:[db.prods[p[0]]].filter(Boolean)};
 if(s.startsWith('INSERT INTO products')){const id=99;db.prods[id]={id,category_id:p[0],product_name:p[1],product_slug:p[3],price:p[6],stock_quantity:p[9],is_available:p[10],image_url:p[8]};db.log.push('insert');return{rows:[{id}]}}
 if(s.startsWith('UPDATE products SET category_id')){const r=db.prods[p[0]];Object.assign(r,{category_id:p[1],price:p[7]});db.log.push('update');return{rows:[]}}
 if(s.startsWith('SELECT p.id, p.category_id, p.product_name')&&s.includes('WHERE p.id = $1 AND c.is_active')){const r=db.prods[p[0]];return{rows:r&&db.cats[r.category_id].is_active?[full(r)]:[]}}
 if(s.startsWith('SELECT p.id, p.category_id, p.product_name')&&s.includes('WHERE p.id = $1')){return{rows:[full(db.prods[p[0]])]}}
 if(s.startsWith('SELECT p.id, p.price, p.stock_quantity, p.is_available FROM products p JOIN categories')){const r=db.prods[p[0]];return{rows:r&&db.cats[r.category_id].is_active?[r]:[]}}
 if(s.startsWith('SELECT o.id, o.user_id, o.total_amount')){const o=db.orders[p[0]];return{rows:[{...o,user_id:1,total_amount:90,customer_name:'C',phone:'1',delivery_address:'a',created_at:new Date()}]}}
 throw new Error('UNMOCKED: '+s.slice(0,90));
}
const tx=async fn=>fn({query:async(sql,p=[])=>{
 const s=sql.replace(/\s+/g,' ').trim();
 if(s.startsWith('SELECT id, order_status FROM orders'))return{rows:[db.orders[p[0]]].filter(Boolean)};
 if(s.startsWith('SELECT product_id, quantity FROM order_items'))return{rows:db.items[p[0]]||[]};
 if(s.startsWith('UPDATE products SET stock_quantity = stock_quantity +')){db.prods[p[0]].stock_quantity+=p[1];db.log.push('restock');return{rows:[]}}
 if(s.startsWith('UPDATE orders SET order_status')){db.orders[p[0]].order_status=p[1];return{rows:[]}}
 throw new Error('UNMOCKED TX: '+s.slice(0,90));}});
const orig=Module._load;
Module._load=function(r,...a){ if(r==='../config/db'||r==='./config/db')return{pool:{},query:q,queryOne:async(s,p)=>(await q(s,p)).rows[0]||null,transaction:tx}; return orig.call(this,r,...a)};
const jwt=require(ROOT+'/node_modules/jsonwebtoken');
const tok=u=>jwt.sign({sub:String(u)},process.env.SESSION_SECRET);
const app=require(ROOT+'/server/app.js');
const srv=app.listen(0,async()=>{
 const base='http://127.0.0.1:'+srv.address().port;
 let pass=0,fail=0;
 const call=async(m,u,b,who)=>{const r=await fetch(base+u,{method:m,headers:{'content-type':'application/json',...(who?{cookie:'magizham_session='+tok(who)}:{})},body:b?JSON.stringify(b):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}};
 const t=async(name,got,want,extra)=>{const ok=got===want;ok?pass++:fail++;console.log((ok?'PASS':'FAIL')+'  '+name+'  ->  '+got+(ok?'':' (wanted '+want+')')+(extra?'  '+extra:''))};
 const good={category_id:1,product_name:'Test Podi',price:50,weight:'100g',stock_quantity:3,is_available:true,image_url:'images/idli-podi.jpg'};
 let r;
 r=await call('POST','/api/admin/products',good);                       t('no login -> create product',r.s,401);
 r=await call('POST','/api/admin/products',good,1);                     t('customer -> create product',r.s,403);
 r=await call('POST','/api/auth/register',{name:'Eve',email:'e@x.in',password:'abcd1234',role:'admin'}); t('register with role:admin rejected',r.s,400);
 r=await call('POST','/api/admin/products',{...good,category_id:2},2);  t('admin: inactive category rejected',r.s,400,r.j.error&&r.j.error.message);
 r=await call('POST','/api/admin/products',{...good,category_id:77},2); t('admin: unknown category rejected',r.s,400);
 r=await call('POST','/api/admin/products',{...good,image_url:'https://evil.example/x.png'},2); t('admin: external image rejected',r.s,400);
 r=await call('POST','/api/admin/products',{...good,image_url:'images/../.env'},2); t('admin: path traversal rejected',r.s,400);
 r=await call('POST','/api/admin/products',{...good,image_url:'images/nope.jpg'},2); t('admin: missing image file rejected',r.s,400);
 r=await call('POST','/api/admin/products',{...good,product_name:'தக்காளி'},2); t('admin: Tamil-only English name rejected (no 500)',r.s,400);
 r=await call('POST','/api/admin/products',{...good,price:-1},2);       t('admin: negative price rejected',r.s,400);
 r=await call('POST','/api/admin/products',good,2);                     t('admin: valid product created',r.s,201,'id='+(r.j.data&&r.j.data.product&&r.j.data.product.id));
 r=await call('PATCH','/api/admin/products/10',{category_id:2},2);      t('admin: move into inactive category rejected',r.s,400);
 r=await call('PATCH','/api/admin/products/20',{price:55},2);           t('admin: edit price of product already in inactive category allowed',r.s,200);
 r=await call('PATCH','/api/admin/products/10',{image_url:'javascript:alert(1)'},2); t('admin: javascript: image rejected',r.s,400);
 r=await call('PATCH','/api/admin/orders/1',{order_status:'confirmed'},2); t('admin: re-open cancelled order rejected',r.s,409);
 const before=db.prods[10].stock_quantity;
 r=await call('PATCH','/api/admin/orders/2',{order_status:'cancelled'},2); t('admin: cancel order -> 200',r.s,200);
 await t('cancel restored stock exactly once',db.prods[10].stock_quantity-before,2);
 r=await call('PATCH','/api/admin/orders/2',{order_status:'cancelled'},2); await t('cancel again does not restock twice',db.prods[10].stock_quantity-before,2);
 r=await call('GET','/api/products/20');                                t('public: product in inactive category -> 404',r.s,404);
 r=await call('GET','/api/products/10');                                t('public: active product -> 200',r.s,200);
 r=await call('POST','/api/cart',{product_id:20,quantity:1},1);         t('cart: inactive-category product -> 404',r.s,404);
 console.log(`\n${pass} passed, ${fail} failed`);srv.close();process.exit(fail?1:0);
});
