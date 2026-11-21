// Uses a fresh, disposable database; never the database named in MONGODB_URI.
require("dotenv").config({ quiet: true });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
// Reuse the existing workspace's Socket.IO client; no extra installation needed.
const { io: client } = require("../../Frontend/White-Board-Frontend/node_modules/socket.io-client");
const connectToDatabase = require("../db");
const { createServer } = require("../index");
let Canvas, User;
const shape={id:0,type:"RECTANGLE",x1:10,y1:20,x2:100,y2:200,stroke:"#123456",fill:null,size:2};
const dbName=`wbt_${randomUUID().replaceAll("-","")}`;

test("backend HTTP, MongoDB and Socket.IO regression checks", { timeout: 90000 }, async t => {
  process.env.JWT_SECRET=randomUUID();
  let server, io; const clients=[];
  t.after(async()=>{
    clients.forEach(socket=>socket.disconnect());
    if(io) await new Promise(resolve=>io.close(resolve));
    else if(server?.listening) await new Promise(resolve=>server.close(resolve));
    // Only this randomly named test database is disposable.
    try {
      if(mongoose.connection.readyState===1 && mongoose.connection.name===dbName && /^wbt_[a-f0-9]{32}$/.test(dbName)) {
        for (const name of ["Users", "Canvas"]) {
          try { await mongoose.connection.dropCollection(name); }
          catch (error) { if (error.code !== 26) throw error; }
        }
      }
    } finally { await mongoose.disconnect(); }
  });
  await connectToDatabase({dbName});
  assert.equal(mongoose.connection.name,dbName);
  Canvas = require("../models/canvasModel");
  User = require("../models/userModel");
  await User.init();
  let ready=true;
  ({server,io}=createServer({isReady:()=>ready && mongoose.connection.readyState===1}));
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(method,path,body,token)=>{
    const res=await fetch(base+path,{method,headers:{...(body===undefined?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,body:await res.json(),headers:res.headers};
  };
  const connect=async(token)=>{
    const socket=client(base,{auth:{token},transports:["websocket"],reconnection:false});clients.push(socket);
    await Promise.race([once(socket,"connect"),once(socket,"connect_error").then(([e])=>Promise.reject(e))]);return socket;
  };
  const emit=(socket,event,data)=>socket.timeout(4000).emitWithAck(event,data);
  let owner, collaborator, outsider, id, ownerSocket, collaboratorSocket, outsiderSocket;
  const password="backend-test-password";
  await t.test("health and API return 503 during database outages",async()=>{
    assert.equal((await request("GET","/health")).status,200);
    ready=false;assert.equal((await request("GET","/health")).status,503);assert.equal((await request("GET","/api/canvases")).status,503);ready=true;
  });
  await t.test("register, duplicate registration, login, profile, and missing user",async()=>{
    const accounts=[];
    for(const name of ["Owner","Collaborator","Outsider"]){
      const result=await request("POST","/api/users/register",{name,email:`${name.toLowerCase()}@example.com`,password});
      assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.user.password,undefined);accounts.push(result.body);
    }
    [owner,collaborator,outsider]=accounts;
    const duplicate=await request("POST","/api/users/register",{name:"Duplicate",email:owner.user.email,password});assert.equal(duplicate.status,409);assert.doesNotMatch(duplicate.body.message,/E11000|index|collection/);
    assert.equal((await request("POST","/api/users/login",{email:owner.user.email,password:"wrong-password"})).status,401);
    assert.equal((await request("POST","/api/users/login",{email:owner.user.email,password})).status,201);
    const profile=await request("GET","/api/users/profile",undefined,owner.token);assert.equal(profile.body.user.name,"Owner");assert.equal(profile.body.user.password,undefined);
    const missing=jwt.sign({email:"missing@example.com"},process.env.JWT_SECRET,{expiresIn:60});
    const result=await request("GET","/api/users/profile",undefined,missing);assert.equal(result.status,401);assert.doesNotMatch(result.body.message,/error is not defined/);
    const stored=await User.findOne({email:owner.user.email});assert.equal(stored.password,undefined);
    assert.notEqual((await User.findOne({email:owner.user.email}).select("+password")).password,password);
  });
  await t.test("invalid bodies, IDs, and drawing data fail cleanly",async()=>{
    for(const body of [null,[],{email:{$ne:null},password},{email:owner.user.email,password:[]}]) assert.equal((await request("POST","/api/users/login",body)).status,400);
    assert.equal((await request("POST","/api/users/register",{name:{},email:"badname@example.com",password})).status,400);
    assert.equal((await request("GET","/api/canvases")).status,401);
    assert.equal((await request("GET","/api/canvases/load/bad-id",undefined,owner.token)).status,400);
    assert.equal((await request("POST","/api/canvases",{shared_with:[collaborator.user.id]},owner.token)).status,400);
    assert.equal((await request("POST","/api/canvases",{elements:[{type:"bogus"}]},owner.token)).status,400);
    const malformed=await fetch(base+"/api/users/login",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"bad":'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).message,"Invalid JSON body");
    const tooLarge=await request("POST","/api/canvases",{name:"Large",elements:[],padding:"x".repeat(2*1024*1024)},owner.token);assert.equal(tooLarge.status,413);
  });
  await t.test("owner can create, load and update; outsiders cannot access or edit",async()=>{
    const result=await request("POST","/api/canvases",{name:"Test board",elements:[shape]},owner.token);assert.equal(result.status,201);id=result.body.canvas._id;
    assert.equal((await request("GET",`/api/canvases/load/${id}`,undefined,owner.token)).status,200);
    for(const [method,path,body] of [["GET",`/api/canvases/load/${id}`],["PUT",`/api/canvases/${id}`,{elements:[]}],["DELETE",`/api/canvases/${id}`],["PUT",`/api/canvases/share/${id}`,{sharedWithEmail:collaborator.user.email}]]) assert.equal((await request(method,path,body,outsider.token)).status,403);
    assert.equal((await request("PUT",`/api/canvases/${id}`,{},owner.token)).status,400);
    assert.equal((await request("PUT",`/api/canvases/share/${id}`,{sharedWithEmail:{$ne:null}},owner.token)).status,400);
    assert.equal((await request("GET","/api/canvases",undefined,outsider.token)).body.count,0);
  });
  await t.test("parallel shares remain unique and do not overwrite canvas updates",async()=>{
    const updated={...shape,x2:150};
    const results=await Promise.all([
      ...Array.from({length:6},()=>request("PUT",`/api/canvases/share/${id}`,{sharedWithEmail:collaborator.user.email},owner.token)),
      request("PUT",`/api/canvases/${id}`,{elements:[updated]},owner.token),
      request("GET",`/api/canvases/load/${id}`,undefined,owner.token),
    ]);results.forEach(result=>assert.equal(result.status,200));
    const stored=await Canvas.findById(id);assert.equal(stored.shared_with.length,1);assert.equal(stored.elements[0].x2,150);
    assert.equal((await request("GET",`/api/canvases/load/${id}`,undefined,collaborator.token)).status,200);
    assert.equal((await request("PUT",`/api/canvases/${id}`,{elements:[shape]},collaborator.token)).status,200);
    assert.equal((await request("DELETE",`/api/canvases/${id}`,undefined,collaborator.token)).status,403);
    assert.equal((await request("PUT",`/api/canvases/share/${id}`,{sharedWithEmail:outsider.user.email},collaborator.token)).status,403);
  });
  await t.test("socket handshake rejects missing identity, invalid or expired tokens",async()=>{
    for(const token of [undefined,"invalid",jwt.sign({email:owner.user.email},process.env.JWT_SECRET,{expiresIn:-1}),jwt.sign({userId:"no-email"},process.env.JWT_SECRET,{expiresIn:60})]) {
      const socket=client(base,{auth:{token},transports:["websocket"],reconnection:false});clients.push(socket);const [error]=await once(socket,"connect_error");assert.match(error.message,/session/i);socket.disconnect();
    }
    ownerSocket=await connect(owner.token);collaboratorSocket=await connect(collaborator.token);outsiderSocket=await connect(outsider.token);
  });
  await t.test("outsiders cannot join or spoof drawing/cursor/presence broadcasts",async()=>{
    assert.equal((await emit(ownerSocket,"join-canvas",id)).success,true);
    assert.equal((await emit(collaboratorSocket,"join-canvas",id)).success,true);
    assert.equal((await emit(outsiderSocket,"join-canvas",id)).status,403);
    const events=[];ownerSocket.onAny(event=>events.push(event));
    for(const [event,data] of [["canvas-update",{canvasId:id,elements:[]}],["cursor-move",{canvasId:id,position:{x:1,y:2}}],["user-presence",{canvasId:id,action:"join"}]]) assert.equal((await emit(outsiderSocket,event,data)).status,403);
    assert.equal(events.length,0);
    for(const data of [undefined,null,{},[],{canvasId:{$ne:null}}]) assert.equal((await emit(outsiderSocket,"canvas-update",data)).success,false);
    assert.equal((await request("GET","/health")).status,200);
  });
  await t.test("authorized drawing/cursor updates work and unchanged REST saves do not echo",async()=>{
    const update=once(collaboratorSocket,"canvas-updated");assert.equal((await emit(ownerSocket,"canvas-update",{canvasId:id,elements:[shape]})).success,true);assert.equal((await update)[0].elements[0].type,"RECTANGLE");
    const cursor=once(ownerSocket,"cursor-moved");await emit(collaboratorSocket,"cursor-move",{canvasId:id,position:{x:20,y:30}});assert.equal((await cursor)[0].position.x,20);
    assert.equal((await emit(ownerSocket,"cursor-move",{canvasId:id,position:{x:"bad",y:0}})).status,400);
    let count=0;const onUpdate=()=>count++;collaboratorSocket.on("canvas-updated",onUpdate);
    const updated={...shape,x2:250};await request("PUT",`/api/canvases/${id}`,{elements:[updated]},owner.token);await request("PUT",`/api/canvases/${id}`,{elements:[updated]},owner.token);
    await new Promise(resolve=>setTimeout(resolve,100));assert.equal(count,1);collaboratorSocket.off("canvas-updated",onUpdate);
  });
  await t.test("live previews reach collaborators without changing the saved canvas", async () => {
    const element = { ...shape, id: randomUUID(), x2: 300 };
    const preview = once(collaboratorSocket, "canvas-preview");
    assert.equal((await emit(outsiderSocket, "canvas-preview", { canvasId: id, element })).status, 403);
    assert.equal((await emit(ownerSocket, "canvas-preview", { canvasId: id, element })).success, true);
    assert.deepEqual((await preview)[0], { canvasId: id, sender: ownerSocket.id, element });
    const saved = await request("GET", `/api/canvases/load/${id}`, undefined, owner.token);
    assert.ok(saved.body.canvas.elements.every(({ id }) => id !== element.id));

    const cleared = once(collaboratorSocket, "canvas-preview");
    await emit(ownerSocket, "canvas-preview", { canvasId: id, element: null, elementId: element.id });
    assert.equal((await cleared)[0].elementId, element.id);
  });
  await t.test("eraser and history previews arrive before autosave", async () => {
    const editId = randomUUID();
    const edit = { add: [], remove: [shape.id] };
    const event = { canvasId: id, editId, edit };
    const origin = `/api/canvases/${id}`;
    assert.equal((await emit(outsiderSocket, "canvas-edit-preview", event)).status, 403);
    assert.equal((await emit(ownerSocket, "canvas-edit-preview", { ...event, edit: { add: [], remove: [{}] } })).status, 400);

    const preview = once(collaboratorSocket, "canvas-edit-preview");
    await emit(ownerSocket, "canvas-edit-preview", event);
    assert.deepEqual((await preview)[0], { ...event, sender: ownerSocket.id, edit: { ...edit, editId } });
    const existing = await request("GET", `/api/canvases/load/${id}`, undefined, owner.token);
    assert.ok(existing.body.canvas.elements.some(({ id }) => id === shape.id));

    const committed = once(collaboratorSocket, "canvas-updated");
    assert.equal((await request("PATCH", origin, { ...edit, editId }, owner.token)).status, 200);
    const [saved] = await committed;
    assert.equal(saved.editId, editId);
    assert.ok(saved.elements.every(({ id }) => id !== shape.id));
  });
  await t.test("concurrent edits, undo, redo, and reconnect preserve collaborator changes", async () => {
    const path = `/api/canvases/${id}`;
    const edit = (add, remove, editId = randomUUID()) => ({ editId, add, remove });
    const erasure = { ...shape, id: shape.id, x1: 33 };
    const legacy = [{ ...shape }, erasure];
    await Canvas.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { elements: legacy }, $unset: { revision: "", recentEdits: "" } },
    );
    const initial = await emit(collaboratorSocket, "join-canvas", id);
    assert.equal(initial.revision, 0);
    assert.notEqual(initial.elements[0].id, initial.elements[1].id);

    const a = { ...shape, id: randomUUID(), x1: 50 };
    const b = { ...shape, id: randomUUID(), x1: 75 };
    const addA = edit([{ element: a }], []);
    const addB = edit([{ element: b }], []);
    assert.equal((await request("PATCH", path, addA, outsider.token)).status, 403);
    assert.equal((await request("PATCH", path, edit([], [{}]), owner.token)).status, 400);
    const results = await Promise.all([
      request("PATCH", path, addA, owner.token),
      request("PATCH", path, addB, collaborator.token),
    ]);
    assert.ok(results.every(({ status }) => status === 200), JSON.stringify(results));
    const latest = results.sort((first, second) => second.body.revision - first.body.revision)[0].body;
    assert.deepEqual(new Set(latest.elements.map(({ id }) => id)), new Set([...initial.elements.map(({ id }) => id), a.id, b.id]));

    const received = once(collaboratorSocket, "canvas-updated");
    const undo = await request("PATCH", path, edit([], [a.id]), owner.token);
    assert.equal((await received)[0].revision, undo.body.revision);
    const duplicate = await request("PATCH", path, addA, owner.token);
    assert.equal(duplicate.body.revision, undo.body.revision);
    assert.ok(duplicate.body.elements.every(({ id }) => id !== a.id));
    assert.ok(duplicate.body.elements.some(({ id }) => id === b.id));

    await emit(collaboratorSocket, "leave-canvas", id);
    const redo = await request("PATCH", path, edit([{ element: a }], []), owner.token);
    const joined = await emit(collaboratorSocket, "join-canvas", id);
    assert.equal(joined.revision, redo.body.revision);
    assert.deepEqual(joined.elements, redo.body.elements);
  });
  await t.test("disconnect notifies collaborators",async()=>{
    const left=once(ownerSocket,"user-left");collaboratorSocket.disconnect();assert.equal((await left)[0].userEmail,collaborator.user.email);
  });
  await t.test("deleting a canvas evicts its rooms and rejects subsequent socket edits",async()=>{
    const deleted=once(ownerSocket,"canvas-deleted");assert.equal((await request("DELETE",`/api/canvases/${id}`,undefined,owner.token)).status,200);assert.equal((await deleted)[0].canvasId,id);
    assert.equal(io.sockets.sockets.get(ownerSocket.id).rooms.has(id),false);
    assert.equal((await emit(ownerSocket,"canvas-update",{canvasId:id,elements:[]})).status,403);
    assert.equal(await Canvas.countDocuments({_id:id}),0);
  });
  console.log("All integration fixtures were confined to a disposable database; cleanup follows.");
});
