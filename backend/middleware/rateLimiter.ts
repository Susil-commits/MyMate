// @ts-nocheck
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";

const getStore = () => {
  return redisClient
    ? new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) })
    : undefined;
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many payment attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: "Too many password reset attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

export const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40,
  message: { message: "You've sent too many chat messages. Please wait a few minutes before asking more questions." },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});