import "dotenv/config";
import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import { pool } from "./db";
import authRouter from "./auth";
import { requireAuth, AuthRequest } from "./middleware";
import jwt from "jsonwebtoken";
import { upload } from "./upload";
import cloudinary from "./cloudinary";
import cookieParser from "cookie-parser";
import * as cookie from "cookie";
import { asyncHandler } from "./asyncHandler";
import { AppError } from "./error-schema";
import { errorHandler } from "./errorHandler";

// Create an Express application
const app = express();
// Parse JSON bodies
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",   // origin: "http://your-frontend-domain.com" must be specific, not '*', when using credentials
    credentials: true,
  }, // Allow the client to send cookies with the request
});

// when opening test-client.html (client side listening on localhost:3000) in the browser, the "connection" event is triggered.
io.on("connection", (socket) => {
  // socket.handshake.auth.token is the token sent by the client in the connection request (test-client.html)
  // const token = socket.handshake.auth.token;

  // when credentials: true, the cookie sent through handshake is raw string. So need to be parsed (using)
  const rawCookie = socket.handshake.headers.cookie;
  if (!rawCookie) {
    socket.disconnect();
    return;
  }

  const parsedCookie = cookie.parse(rawCookie);
  const accessToken = parsedCookie.accessToken;

  if (!accessToken) {
    socket.disconnect();
    return;
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string) as {
      userId: number;
    };
    socket.join(`user:${decoded.userId}`);
    console.log(`Socket ${socket.id} joined room user:${decoded.userId}`);
  } catch {
    console.log("Socket connected without valid token, disconnecting");
    socket.disconnect();
    return;
  }

  socket.on("disconnect", () => {
    console.log("A client disconnected:", socket.id);
  });
});

/** 
 * Usage: All authentication routes (/signup, /login) are available under /auth.
 * Example: POST /auth/signup, POST /auth/login
*/
app.use("/auth", authRouter);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

// GET all todos — only this user's todos can be accessed
app.get("/todos", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM todos WHERE user_id = $1 ORDER BY id",
    [req.userId],
  );
  res.json(result.rows);
}));

// POST a new todo — only this user can create todos
app.post("/todos", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const text: string = req.body.text;
  if (!text) {
    throw new AppError("Text is required", 400, 'VALIDATION_ERROR');
  }
  const result = await pool.query(
    "INSERT INTO todos (text, done, user_id) VALUES ($1, false, $2) RETURNING *",
    [text, req.userId],
  );

  const newTodo = result.rows[0];
  // Broadcast the new todo to all connected clients
  // io.emit("todo:created", newTodo);

  // Broadcast the new todo to the user's room only
  io.to(`user:${req.userId}`).emit("todo:created", newTodo);

  res.status(201).json(newTodo);
}));

// POST a new image for a todo
app.post("/todos/:id/image", requireAuth, upload.single("image"), asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);
  const image = req.file;
  if (!image) {
    throw new AppError("Image file is required", 400, 'VALIDATION_ERROR');
  }

    // Upload the image to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'todo-images' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    // Update the todo with the new image URL (image_url is the column name in the todos table)
    const result = await pool.query(
      'UPDATE todos SET image_url = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [uploadResult.secure_url, id, req.userId]
    );

    // If the todo is not found, return a 404 error
    if (result.rows.length === 0) {
      throw new AppError("Todo not found", 404, 'NOT_FOUND');
    }

    io.to(`user:${req.userId}`).emit('todo:updated', result.rows[0]);
    res.json(result.rows[0]);
}));

// PUT update — only if it belongs to this user
app.put("/todos/:id", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await pool.query(
    "SELECT * FROM todos WHERE id = $1 AND user_id = $2",
    [id, req.userId],
  );
  if (existing.rows.length === 0) {
    throw new AppError("Todo not found", 404, 'NOT_FOUND');
  }
  const current = existing.rows[0];
  const text = req.body.text ?? current.text;
  const done = req.body.done ?? current.done;
  const result = await pool.query(
    "UPDATE todos SET text = $1, done = $2 WHERE id = $3 RETURNING *",
    [text, done, id],
  );

  // io.emit("todo:updated", result.rows[0]);

  io.to(`user:${req.userId}`).emit("todo:updated", result.rows[0]);

  res.json(result.rows[0]);
}));

// DELETE — only if it belongs to this user
app.delete(
  "/todos/:id",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string);
    await pool.query("DELETE FROM todos WHERE id = $1 AND user_id = $2", [
      id,
      req.userId,
    ]);

    // io.emit("todo:deleted", { id });

    io.to(`user:${req.userId}`).emit("todo:deleted", { id });

    res.status(204).send();
  })
);

// should be called as the very last call
app.use(errorHandler);

/**
 *  app.listen(port): creates an HTTP server implicitly.
 *  for implementing Socket.io, we need to create a server explicitly using the http module.
 *  Socket.io needs to attach it self to the HTTP server object. Also the Express is attached to the HTTP server object.
 */
const PORT = 3001;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// real server listening to the port
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
