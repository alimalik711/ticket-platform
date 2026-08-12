import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.js";
import { getCurrentUser } from "./auth.controller.js";

const authRouter = Router();

authRouter.get("/me", requireAuth, getCurrentUser);

export { authRouter };