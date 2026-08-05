import "dotenv/config";
import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import { pool } from "./db";
import authRouter from "./auth";
import { requireAuth, AuthRequest } from "./middleware";

// Create an Express application
const app = express();
// Parse JSON bodies
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // Allow all origins
});

io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("A client disconnected:", socket.id);
  });
});

// Usage: All authentication routes (/signup, /login) are available under /auth.
// Example: POST /auth/signup, POST /auth/login
app.use("/auth", authRouter);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

// GET all todos — only this user's todos can be accessed
app.get("/todos", requireAuth, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM todos WHERE user_id = $1 ORDER BY id",
    [req.userId],
  );
  res.json(result.rows);
});

// POST a new todo — only this user can create todos
app.post("/todos", requireAuth, async (req: AuthRequest, res: Response) => {
  const text: string = req.body.text;
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  const result = await pool.query(
    "INSERT INTO todos (text, done, user_id) VALUES ($1, false, $2) RETURNING *",
    [text, req.userId],
  );

  const newTodo = result.rows[0];
  // Broadcast the new todo to all connected clients
  io.emit("todo:created", newTodo);

  res.status(201).json(newTodo);
});

// PUT update — only if it belongs to this user
app.put("/todos/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await pool.query(
    "SELECT * FROM todos WHERE id = $1 AND user_id = $2",
    [id, req.userId],
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }
  const current = existing.rows[0];
  const text = req.body.text ?? current.text;
  const done = req.body.done ?? current.done;
  const result = await pool.query(
    "UPDATE todos SET text = $1, done = $2 WHERE id = $3 RETURNING *",
    [text, done, id],
  );

  io.emit("todo:updated", result.rows[0]);

  res.json(result.rows[0]);
});

// DELETE — only if it belongs to this user
app.delete(
  "/todos/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string);
    await pool.query("DELETE FROM todos WHERE id = $1 AND user_id = $2", [
      id,
      req.userId,
    ]);

    io.emit("todo:deleted", { id });

    res.status(204).send();
  },
);

/**
 *  app.listen(port): creates an HTTP server implicitly.
 *  for implementing Socket.io, we need to create a server explicitly using the http module.
 *  Socket.io needs to attach it self to the HTTP server object. Also the Express is attached to the HTTP server object.
 */
const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// real server listening to the port
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
