# 🚀 Real-Time Collaborative IDE

A lightweight, web-based collaborative code editor built for seamless multi-user programming, featuring real-time synchronization, multi-file management, and an integrated code execution terminal.

![Version](https://img.shields.io/badge/version-1.00.00-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

---

## ✨ Key Features

* **Real-Time Collaboration:** Join rooms via unique Room IDs to code together synchronously with live user-count tracking and activity logs.
* **Multi-File Management:** Create, switch between, and delete multiple files dynamically with real-time room synchronization and duplicate-name prevention.
* **Integrated Code Editor:** Powered by **Monaco Editor** (the engine behind VS Code) with support for syntax highlighting, custom themes (`vs-dark`, `light`, `hc-black`), adjustable font sizes, and minimaps.
* **Built-In Execution Terminal:** Run code directly inside the application supporting **JavaScript, Python, and C++** via the JDoodle API, complete with standard input (`stdin`) handling.
* **Secure Architecture:** Built with protected environment variables (`.env`) for backend API credentials and production-ready port configurations.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Monaco Editor (`@monaco-editor/react`), Socket.io-client
* **Backend:** Node.js, Express, Socket.io, Dotenv, JDoodle API

---

## 📂 Project Structure

```text
c-app/
├── backend/
│   ├── .env              # Backend environment variables (Secret)
│   ├── package.json
│   └── server.js         # Express & Socket.io server
├── frontend/
│   ├── .env              # Frontend environment variables
│   ├── src/
│   │   ├── App.jsx       # Main IDE workspace & socket handlers
│   │   ├── OutputTreminal.jsx # Code execution terminal component
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
└── README.md
