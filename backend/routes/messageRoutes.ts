// @ts-nocheck
import { Router } from "express";
import { protect, authorizeUserOrDriver } from "../middleware/auth.js";
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
} from "../controllers/messageController.js";

const router = Router();

router.use(protect, authorizeUserOrDriver);

router.post("/conversations", getOrCreateConversation);
router.get("/conversations", getConversations);
router.get("/:conversationId", getMessages);
router.post("/", sendMessage);
router.put("/:conversationId/read", markConversationRead);

export default router;
