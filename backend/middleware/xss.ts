// @ts-nocheck
import sanitizeHtml from "sanitize-html";
import { Request, Response, NextFunction } from "express";

const sanitize = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeHtml(obj, {
      allowedTags: [], // Strip all HTML tags
      allowedAttributes: {},
    });
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => sanitize(v));
  }
  if (typeof obj === "object" && obj !== null) {
    const cleanObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cleanObj[key] = sanitize(value);
    }
    return cleanObj;
  }
  return obj;
};

export const xss = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
};
