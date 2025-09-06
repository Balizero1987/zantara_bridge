import { Router } from "express";
import calendar from "./api/calendar";
const router = Router();
router.use(calendar);
export default router;
