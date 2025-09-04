// src/middleware/chatRouter.ts
import express from 'express';

// API routers
import calendarApi from '../api/calendar';
import driveApi from '../api/drive';
import gmailApi from '../api/gmail';
import memoryApi from '../api/memory';
import tasksApi from '../api/tasks';
import codexApi from '../api/codex'; // exposes /actions/codex/dispatch

const router = express.Router();

// mount APIs
router.use(calendarApi);
router.use(driveApi);
router.use(gmailApi);
router.use(memoryApi);
router.use(tasksApi);
router.use(codexApi);

export default router;

// zantara: mount calendar router
import calendar from "./api/calendar";
router.use(calendar);
