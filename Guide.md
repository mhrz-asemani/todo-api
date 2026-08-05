/\*_
\*\* CommonJS is the default module system for Node.js.
_/

/\*\*

- in @tsconfig.json:
- "module": "nodenext"
  - just means "follow whatever Node is actually configured to do," and since your package.json
  - says CommonJS, TypeScript will compile using CommonJS require/module.exports semantics
  - under the hood, even though you'll still write clean import/export syntax in your .ts files
- "module": "commonjs", forces complier to compile to CommonJS semantics.
  \*/

/\*\*

- npm init -y ======== creates package.json file
- npx tsc --init ======== creates tsconfig.json file
- \*/

/\*\*

- Testing API routes using curl
- curl http://localhost:3000/todos
- curl -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d '{"title": "Buy groceries"}'
- curl -X PUT http://localhost:3000/todos/1 -H "Content-Type: application/json" -d '{"title": "Buy groceries"}'
- curl -X DELETE http://localhost:3000/todos/1
  \*/

/\*\*

- Postgresql
- 1- install postgresql
- 2- `bash`: psql -U postgres -p {port} ========= **whenever need to write SQL, connect to postgres using the command. then in shell, first connect to created db using "\c {db_name}"**.
  It opens a Postgres shell using the psql command. If postgres default port is used, no need to -p {port}. If you wanna use custom port number, consider it.
- 3- `sql shell`: CREATE DATABASE {database_name}; ========= creates a new database
- 4- npm install pg & npm install -D @types/pg ======== pg: is a PostgreSQL client for Node.js.
- 5- Create a todos table:
- 5.1- connect to the database in bash:
-      first: dev server must be running: npm run dev
-      then: connect to the database in bash: psql {database_name}
- 5.2- Run sql syntaxes below:
  CREATE TABLE todos (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false
  );
  6- Create db.ts file and import pg
  7- start writing server.ts to communicate with database.
- \*/

/\*\*

- Socket.io — SERVER flow
- 1- npm install socket.io
- 2- Create an HTTP server explicitly (Socket.io cannot attach to app.listen alone):
-      const server = http.createServer(app);
-      const io = new Server(server, { cors: { origin: "*" } });
- 3- Listen with server.listen(PORT) instead of app.listen(PORT).
- 4- On connection:
-      - Read JWT from socket.handshake.auth.token (Socket.io bypasses Express middleware).
-      - jwt.verify → join room `user:{userId}` or disconnect if invalid.
- 5- On todo REST mutations, emit events to clients:
-      - POST /todos  → io.emit("todo:created", newTodo)
-      - PUT /todos/:id → io.emit("todo:updated", todo)
-      - DELETE /todos/:id → io.emit("todo:deleted", { id })
  \*/

/\*\*

- Socket.io — CLIENT flow
- 1- Open test-client.html in the browser (loads socket.io client from CDN).
- 2- Connect with JWT in the handshake auth object:
-      const socket = io("http://localhost:3000", { auth: { token: "<JWT>" } });
-      (token comes from POST /auth/login)
- 3- Listen for server events and update the UI:
-      - "connect" → connected
-      - "todo:created" → new todo payload
-      - "todo:updated" → updated todo payload
-      - "todo:deleted" → { id }
- 4- Server validates the token on connect; invalid token → client is disconnected.
  \*/
