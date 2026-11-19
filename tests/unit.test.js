const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const { validateElements, validateId } = require("../utils/validation");
const validateCredentials = require("../middlewares/validateUserCredential");
const protect = require("../middlewares/validateUserToken");
const { authenticateSocket } = require("../middlewares/socketAuth");
const { issueToken, verifyToken } = require("../utils/tokens");
const { publicError } = require("../utils/errors");
const oldSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "unit-test-only-secret";
after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set(k,v) { this.headers[k] = v; return this; } });
const shape = { id: 0, type: "RECTANGLE", x1: 10, y1: 20, x2: 100, y2: 200, size: 2, stroke: "#123456", fill: null };

test("drawing validation accepts every existing frontend drawing tool", () => {
  for (const type of ["LINE", "RECTANGLE", "CIRCLE", "ARROW", "TEXT", "BRUSH"]) {
    const element = { ...shape, type, text: "Hello", points: [{ x: 0, y: 1 }] };
    assert.equal(validateElements([element])[0].type, type);
  }
  assert.deepEqual(validateElements([]), []);
});
test("malformed drawing data and query-shaped IDs are rejected", () => {
  for (const value of [undefined, null, {}, [null], [{...shape,type:"ERASER"}], [{...shape,x1:Infinity}], [{...shape,size:-1}], [{...shape,type:"BRUSH",points:[null]}], [{...shape,type:"TEXT",text:{}}]]) {
    assert.throws(() => validateElements(value), { status: 400 });
  }
  for (const id of [null, [], {}, {$ne:null}, "abc"]) assert.throws(() => validateId(id), { status: 400 });
});
test("drawing validation strips client-only render objects", () => {
  const result = validateElements([{ ...shape, roughEle: {bad:true}, path: {}, unexpected: true }])[0];
  assert.deepEqual(result, shape);
});
test("credential middleware safely rejects wrong types and bcrypt-truncated passwords", () => {
  for (const body of [undefined,null,[],{}, {email:[],password:"abcdefgh"}, {email:"a@example.com",password:{}}, {email:"a@example.com",password:"é".repeat(40)}]) {
    const res=response();validateCredentials({body},res,()=>assert.fail("invalid credentials accepted"));assert.equal(res.statusCode,400);assert.equal(res.body.success,false);
  }
  const req={body:{email:" a@example.com ",password:"abcdefgh"}};let passed=false;
  validateCredentials(req,response(),()=>passed=true);assert.ok(passed);assert.equal(req.body.email,"a@example.com");
});
test("REST and socket verification use the same identity checks", () => {
  const token=issueToken({email:"a@example.com"});const payload=verifyToken(token);assert.equal(payload.email,"a@example.com");
  const req={headers:{authorization:`Bearer ${token}`}};let passed=false;protect(req,response(),()=>passed=true);assert.ok(passed);assert.equal(req.email,payload.email);
  const socket={handshake:{auth:{token}}};authenticateSocket(socket,error=>assert.equal(error,undefined));assert.equal(socket.email,payload.email);
  const invalid=["invalid",jwt.sign({email:{}},process.env.JWT_SECRET,{expiresIn:60}),jwt.sign({email:"a@example.com"},process.env.JWT_SECRET,{expiresIn:-1}),jwt.sign({email:"a@example.com"},process.env.JWT_SECRET,{algorithm:"HS384",expiresIn:60})];
  for(const value of invalid){assert.throws(()=>verifyToken(value));const res=response();protect({headers:{authorization:`Bearer ${value}`}},res,()=>assert.fail());assert.equal(res.statusCode,401);authenticateSocket({handshake:{auth:{token:value}}},error=>assert.ok(error));}
  authenticateSocket({handshake:{}},error=>assert.ok(error));
});
test("unexpected errors and database internals are not exposed", () => {
  assert.deepEqual(publicError(new Error("mongodb://private-secret")),{status:500,message:"An unexpected server error occurred"});
  assert.equal(publicError({code:11000}).status,409);assert.equal(publicError({type:"entity.too.large"}).status,413);
});
test("startup fails before listening when required config is missing", () => {
  for (const missing of ["MONGODB_URI","JWT_SECRET"]) {
    const env={...process.env,MONGODB_URI:"mongodb://127.0.0.1:1/test",JWT_SECRET:"test",[missing]:""};
    const result=spawnSync(process.execPath,["index.js"],{cwd:path.resolve(__dirname,".."),env,encoding:"utf8",timeout:4000});
    assert.equal(result.status,1,result.stderr);assert.doesNotMatch(result.stdout,/Server is running/);
  }
});
