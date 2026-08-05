"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    user: "Famin-PC",
    host: "127.0.0.1",
    database: "todo_db",
    password: "1374",
    port: 5374,
});
