"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import { Todo } from "./types";
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// let todos: Todo[] = [];
// let nextId = 1;
app.get("/", (req, res) => {
    res.send("Hello World");
});
// Get all todos
app.get("/todos", async (req, res) => {
    const result = await db_1.pool.query("SELECT * FROM todos ORDER BY id ASC");
    //   res.json(todos);
    res.json(result.rows);
});
// Post(create) a new todo
app.post("/todos", async (req, res) => {
    const text = req.body.text;
    if (!text)
        return res.status(400).json({ error: "Text is required" });
    const result = await db_1.pool.query("INSERT INTO todos (text, done) VALUES ($1, false) RETURNING *", [text]);
    res.status(201).json(result.rows[0]);
});
// Update a todo
app.put("/todos/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const existingTodo = await db_1.pool.query("SELECT * FROM todos WHERE id = $1", [
        id,
    ]);
    if (existingTodo.rows.length === 0)
        return res.status(404).json({ error: "Todo not found" });
    const text = req.body.text || existingTodo.rows[0].text;
    const done = req.body.done !== undefined ? req.body.done : existingTodo.rows[0].done;
    const result = await db_1.pool.query("UPDATE todos SET text = $1, done = $2 WHERE id = $3 RETURNING *", [text, done, id]);
    res.status(200).json(result.rows[0]);
});
// Delete a todo
app.delete("/todos/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await db_1.pool.query("DELETE FROM todos WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0)
        return res.status(404).json({ error: "Todo not found" });
    res.status(204).send();
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
