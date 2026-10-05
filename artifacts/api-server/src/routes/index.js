import { Router } from "express";
import healthRouter from "./health";
import sensorRouter from "./sensor";
const router = Router();
router.use(healthRouter);
router.use(sensorRouter);
var routes_default = router;
export {
  routes_default as default
};
