// @ts-nocheck
import { Response } from "express";

export class ApiResponse {
  static success(res: Response, data: any = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, message = "Error", statusCode = 500, errors: any = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}
