// The single switch for "which exam is this deployment": everything in
// src/components and src/App.jsx imports the active exam from here, never
// from src/exams/<id>/ directly. To ship a different exam from this same
// platform, add a new src/exams/<id>/ package (see docs/PLATFORM.md) and
// change only the line below.
export { default } from "./gat/index.js";
