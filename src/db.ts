import { Pool } from "pg";

export const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "todo_db",
  password: "1374",
  port: 5374,
});
