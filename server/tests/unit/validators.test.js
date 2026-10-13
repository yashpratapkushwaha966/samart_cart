import test from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../../src/validators/schemas.js';
const oid='64b7f0c2a1b2c3d4e5f60718';
const bad=(schema,data)=>assert.equal(schema.safeParse(data).success,false,JSON.stringify(data));
const good=(schema,data)=>{const r=schema.safeParse(data);assert.ok(r.success,r.error?.message);return r.data;};

test('email is lowercased/trimmed; otp must be 6 digits', ()=>{
  assert.equal(good(s.otpRequest,{email:'  Foo@Bar.COM ',name:'Ravi Kumar',phone:'9876543210'}).email,'foo@bar.com');
  const who={name:'Ravi Kumar',phone:'9876543210'};
  bad(s.otpRequest,{email:'nope',...who});
  bad(s.otpRequest,{email:'a@b.com'}); bad(s.otpRequest,{email:'a@b.com',name:'Ravi Kumar'}); bad(s.otpRequest,{email:'a@b.com',phone:'9876543210'}); // name + phone are compulsory
  bad(s.otpVerify,{email:'a@b.com',code:'12345',...who}); bad(s.otpVerify,{email:'a@b.com',code:'12345a',...who});
  good(s.otpVerify,{email:'a@b.com',code:'123456',...who});
});
test('create order: quantity, ids, method, key', ()=>{
  const base={outletSlug:'main-cart',items:[{productId:oid,quantity:2}],serviceType:'takeaway',paymentMethod:'cash',idempotencyKey:'abcdefgh1234'};
  good(s.createOrderBody,base);
  bad(s.createOrderBody,{...base,serviceType:undefined}); bad(s.createOrderBody,{...base,serviceType:'delivery'}); good(s.createOrderBody,{...base,serviceType:'dine_in'});
  bad(s.createOrderBody,{...base,items:[]});
  bad(s.createOrderBody,{...base,items:[{productId:'zzz',quantity:1}]});
  bad(s.createOrderBody,{...base,items:[{productId:oid,quantity:0}]});
  bad(s.createOrderBody,{...base,items:[{productId:oid,quantity:21}]});
  bad(s.createOrderBody,{...base,items:[{productId:oid,quantity:1.5}]});
  bad(s.createOrderBody,{...base,paymentMethod:'bitcoin'});
  bad(s.createOrderBody,{...base,idempotencyKey:'short'});
  assert.equal(good(s.createOrderBody,{...base,offerCode:' welcome10 '}).offerCode,'WELCOME10');
  assert.equal(good(s.createOrderBody,{...base,offerCode:''}).offerCode,undefined);
});
test('client cannot smuggle a price, total or role into an order', ()=>{
  const r=good(s.createOrderBody,{outletSlug:'main-cart',items:[{productId:oid,quantity:1,pricePaise:1}],serviceType:'dine_in',paymentMethod:'cash',idempotencyKey:'abcdefgh1234',totalPaise:1,role:'admin',status:'Completed'});
  assert.equal(r.totalPaise,undefined); assert.equal(r.role,undefined); assert.equal(r.status,undefined); assert.equal(r.items[0].pricePaise,undefined);
});
test('status body only accepts real statuses', ()=>{ good(s.statusBody,{status:'Ready'}); bad(s.statusBody,{status:'Teleported'}); });
test('profile update does not accept a role', ()=>{ assert.equal(good(s.profileUpdate,{name:'Ravi',role:'admin'}).role,undefined); bad(s.profileUpdate,{phone:'abc'}); });
test('staff create: strong password + at least one cart', ()=>{
  const b={name:'A',email:'a@b.com',password:'longenough1',outletIds:[oid]};
  good(s.staffCreate,b); bad(s.staffCreate,{...b,password:'short'}); bad(s.staffCreate,{...b,outletIds:[]});
  assert.equal(good(s.staffCreate,{...b,role:'admin'}).role,undefined);
});
test('offer rules', ()=>{
  const b={code:'diwali20',title:'Diwali',type:'percent',value:20};
  const r=good(s.offerBody,b); assert.equal(r.code,'DIWALI20'); assert.equal(r.perUserLimit,1);
  bad(s.offerBody,{...b,value:150}); bad(s.offerBody,{...b,code:'a b'}); good(s.offerBody,{...b,type:'flat',value:5000});
  assert.equal(good(s.offerBody,{...b,startsAt:'',expiresAt:''}).expiresAt,undefined);
});
test('product: price in paise, image must be upload or https', ()=>{
  const b={name:'Veg',pricePaise:6000,category:oid};
  good(s.productBody,b); bad(s.productBody,{...b,pricePaise:50}); bad(s.productBody,{...b,pricePaise:60.5});
  good(s.productBody,{...b,imageUrl:'/uploads/abc123.jpg'}); good(s.productBody,{...b,imageUrl:'https://x.com/a.jpg'});
  bad(s.productBody,{...b,imageUrl:'javascript:alert(1)'}); bad(s.productBody,{...b,imageUrl:'http://x.com/a.jpg'}); bad(s.productBody,{...b,imageUrl:'/uploads/../../etc/passwd'});
});
test('outlet UPI id format', ()=>{ good(s.outletPatch,{upi:{vpa:'cart@okaxis'}}); good(s.outletPatch,{upi:{vpa:''}}); bad(s.outletPatch,{upi:{vpa:'not a upi'}}); });
test('gateway verify needs all three fields', ()=>{
  good(s.gatewayVerify,{orderId:oid,razorpay_order_id:'order_ABCDE',razorpay_payment_id:'pay_ABCDE',razorpay_signature:'a'.repeat(64)});
  bad(s.gatewayVerify,{orderId:oid,razorpay_order_id:'order_ABCDE',razorpay_payment_id:'pay_ABCDE'});
});
