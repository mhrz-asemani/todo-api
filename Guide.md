# Todo API Guide

Personal notes for this project — setup, database, sockets, and auth quirks.

---

## Modules: CommonJS vs TypeScript

Node.js defaults to **CommonJS** (`require` / `module.exports`).

In `tsconfig.json`:

- `"module": "nodenext"` — Follow whatever Node is configured to do. Since `package.json` uses CommonJS, TypeScript compiles to CommonJS under the hood. You still write clean `import` / `export` in `.ts` files.
- `"module": "commonjs"` — Forces the compiler to emit CommonJS semantics.

### Project bootstrap

```bash
npm init -y          # creates package.json
npx tsc --init       # creates tsconfig.json
```

---

## Testing API routes with curl

```bash
curl http://localhost:3000/todos

curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries"}'

curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries"}'

curl -X DELETE http://localhost:3000/todos/1
```

---

## PostgreSQL

1. Install PostgreSQL.
2. Open a Postgres shell:

```bash
 psql -U postgres -p {port}
```

Skip `-p {port}` if you're using the default port. Whenever you need to write SQL, connect with `psql`, then switch to your database with `\c {db_name}`. 3. Create a database (inside the SQL shell):

```sql
 CREATE DATABASE {database_name};
```

4. Install the Node client:

```bash
 npm install pg
 npm install -D @types/pg
```

`pg` is the PostgreSQL client for Node.js. 5. Create the `todos` table:

- Start the dev server: `npm run dev`
- Connect to the database:
  ```bash
  psql {database_name}
  ```
- Run:
  ```sql
  CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT false
  );
  ```

6. Create `db.ts` and import `pg`.
7. Wire up `server.ts` so the API talks to the database.

---

## Socket.io — server flow

1. Install:

```bash
 npm install socket.io
```

2. Create an HTTP server explicitly (Socket.io cannot attach to `app.listen` alone):

```ts
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
```

3. Listen with `server.listen(PORT)` instead of `app.listen(PORT)`.
4. On connection:

- Read the JWT from `socket.handshake.auth.token` (Socket.io bypasses Express middleware).
- `jwt.verify` → join room `user:{userId}`, or disconnect if the token is invalid.

5. On todo REST mutations, emit events to clients:

| Route               | Event          | Payload   |
| ------------------- | -------------- | --------- |
| `POST /todos`       | `todo:created` | `newTodo` |
| `PUT /todos/:id`    | `todo:updated` | `todo`    |
| `DELETE /todos/:id` | `todo:deleted` | `{ id }`  |

---

## Socket.io — client flow

1. Open `test-client.html` in the browser (loads the Socket.io client from CDN).
2. Connect with a JWT in the handshake auth object (token comes from `POST /auth/login`):

```js
const socket = io("http://localhost:3000", {
  auth: { token: "<JWT>" },
});
```

3. Listen for server events and update the UI:

| Event          | Meaning              |
| -------------- | -------------------- |
| `connect`      | Connected            |
| `todo:created` | New todo payload     |
| `todo:updated` | Updated todo payload |
| `todo:deleted` | `{ id }`             |

4. The server validates the token on connect. An invalid token disconnects the client.

---

## Cloudinary & Multer

- **Cloudinary** — free image hosting service
- **Multer** — file upload handler for Express

---

## cookie-parser vs cookies in [Socket.io](http://Socket.io)

`cookie-parser` is Express middleware, not a Socket.io tool.

It hooks into Express's request/response cycle: you run `app.use(cookieParser())`, it intercepts an incoming Express `req`, parses the `Cookie` header, and attaches the result to `req.cookies` for your route handlers.

Inside `io.on("connection", (socket) => { ... })` you are **not** in an Express route handler. There is no Express `req` — only `socket.handshake`, Socket.io's own representation of the initial connection. `cookie-parser` was never built to operate on that.

## Error Handling Flow

1. Create a customized error class which extends built-in Error - `errors.ts`
2. Create an async handler as a wrapper for route handlers. Using the wrapper, any errors get passed through Express's error-handling system - `asyncHandler.ts`
3. Create a centralized error handling fn to handle any errors - `errorHandler.ts`
4. Update `server.ts` route handlers to use Wrapper and error class instead of returning error manually.

## Google's canonical status values

- these map to standard gRPC-derieved codes

  | Situation                    | HTTP code | Status value         |
  | ---------------------------- | --------- | -------------------- |
  | `missing/invalid input`      | 400       | `INVALID_ARGUMENT`   |
  | `missing/invalid auth token` | 401       | `UNAUTHENTICATED`    |
  | `valid auth but not allowed` | 403       | `PERMISSION_DENIED`  |
  | `Resource does'nt exist`     | 404       | `NOT_FOUND`          |
  | `Resource already exists`    | 409       | `ALREADY_EXISTS`     |
  | `Rate limiting`              | 429       | `RESOURCE_EXHAUSTED` |
  | `Unexpected server error`    | 500       | `INTERNAL`           |

  ***

## Zod validation - hardens security

```bash
npm install zod
```

- Create a `validate.ts` as middleware.
- Create a `schema.ts` and define the right shapes of anything you want.
- Add the middleware(schema as arg) to each route handler you want to be validated against the right schema

---

## Pino - `pino-pretty / pino-http` - structured logging ({ obj }, message) pattern

1- install

```bash
npm install pino
npm install pino-http
npm install -D pino-pretty
```

- `pino-pretty` formats logs nicely for your terminal during `development`, in production you'd want raw JSON logs instead.
- `pino-http` auto-logs every incoming request/response with timing.
- In dev, you get colorized, readable output. In production, you get plain structured JSON, one log line per event, which is what real logging infrastructure expects.

2- create a logger instance - `logger.ts`
3- Add a request logging middleware by installing `pino-http`
4- Add `pino-htto` in `server.ts` near the app (right after creating app)

- This alone logs every request automatically, method, path, status code, response time, no manual code per-route needed.

5- Replace manual console.log/console.error calls

- `logger.warn` for expected errors (bad input, not found, auth failures, these are normal traffic, not bugs).
- `logger.error` for genuinely unexpected failures.
- This separation matters a lot once you're scanning real logs, you want error level to mean "something is actually broken," not "a user typed a wrong password."

**Why structured logging ({ obj }, message) pattern matters**

- Pino stores the object fields as separate, queryable JSON fields in the log line, not baked into a string. This means in production, you could search logs for "every event where { obj }".
- Something you genuinely cannot do with concatenated strings, this is the entire point of structured logging over console.log.

---

# Security Basics

`helmet . rate-limiting . Tighten CORS . Limit JSON body size`

1- `helmet` sets a batch of HTTP security headers automatically, protecting against things like clickjacking, MIME-sniffing attacks, and disabling some browser features that could leak info.

```bash
npm install helmet
```

2- `rate limit`

```bash
npm install express-rate-limit
```

- This is a real, meaningful defense, without it, brute-forcing a password is just a matter of running a script.

3- Tighten CORS

```bash
npm install cors
npm install -D @types/cors
```

- Right now your Socket.IO CORS config points at http://localhost:3000, which is your own backend, not a real frontend origin. Express itself currently has no CORS config at all on regular routes, meaning any website could make authenticated requests to your API from a browser (though sameSite: 'strict' cookies already block most of the damage here, CORS is still a separate, important layer).

- `FRONTEND_ORIGIN` (Adjust the port to whatever your actual frontend dev server uses, Vite defaults to 5173, Create React App to 3000, since your backend already uses 3000, you'd need your frontend on a different port anyway.)

4- Limit JSON body size

- If there is no size limit to json body, meaning someone could send a massive payload to try to exhaust your server's memory.
- `app.use(express.json({limit: "10kb"}))`
