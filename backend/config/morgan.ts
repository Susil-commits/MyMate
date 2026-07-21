// @ts-nocheck
import morgan from "morgan";
import logger from "./logger.js";
import { Request, Response } from "express";

const stream = {
  write: (message: string) => logger.info(message.trim()),
};

const skip = (req: Request, res: Response) => {
  // Can skip logging successful responses in production if desired,
  // but for "advanced logging", we'll log everything.
  return false; 
};

export const morganMiddleware = morgan(
  ":remote-addr - :remote-user [:date[clf]] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\" - :response-time ms",
  { stream, skip }
);
