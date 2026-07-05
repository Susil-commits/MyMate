import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
} from "../controllers/messageController.js";

const router = Router();

router.post("/conversations", protect, getOrCreateConversation);
router.get("/conversations", protect, getConversations);
router.get("/:conversationId", protect, getMessages);
router.post("/", protect, sendMessage);
router.put("/:conversationId/read", protect, markConversationRead);

export default router;
