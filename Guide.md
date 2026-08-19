# Todo API Guide

Personal notes for this project — setup, database, sockets, and auth quirks.

---

## Modules: CommonJS vs TypeScript

Node.js defaults to **CommonJS** (`require` / `module.exports`).

In `tsconfig.json`:

- **`"module": "nodenext"`** — Follow whatever Node is configured to do. Since `package.json` uses CommonJS, TypeScript compiles to CommonJS under the hood. You still write clean `import` / `export` in `.ts` files.
- **`"module": "commonjs"`** — Forces the compiler to emit CommonJS semantics.

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

   Skip `-p {port}` if you're using the default port. Whenever you need to write SQL, connect with `psql`, then switch to your database with `\c {db_name}`.

3. Create a database (inside the SQL shell):

   ```sql
   CREATE DATABASE {database_name};
   ```

4. Install the Node client:

   ```bash
   npm install pg
   npm install -D @types/pg
   ```

   `pg` is the PostgreSQL client for Node.js.

5. Create the `todos` table:
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

## cookie-parser vs cookies in Socket.io

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

  | Situation                    | HTTP code | Status value        |
  | ---------------------------- | --------- | ------------------- |
  | `missing/invalid input`      | 400       | `INVALID_ARGUMENT`  |
  | `missing/invalid auth token` | 401       | `UNAUTHENTICATED`   |
  | `valid auth but not allowed` | 403       | `PERMISSION_DENIED` |
  | `Resource does'nt exist`     | 404       | `NOT_FOUND`         |
  | `Resource already exists`    | 409       | `ALREADY_EXISTS`    |
  | `Unexpected server error`    | 500       | `INTERNAL`          |
