import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import { convertRouter } from "./convert";
import webrtcRouter from "./webrtc";

const router: IRouter = Router();

router.use(healthRouter);
router.use(filesRouter);
router.use(convertRouter);
router.use(webrtcRouter);

export default router;
