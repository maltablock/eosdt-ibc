import { NextFunction, Request, Response } from "express";
import { latestHealth } from "../utils/health";

export default class HealthController {
  async version(request: Request, response: Response, next: NextFunction) {
    try {
      return JSON.stringify(latestHealth);
    } catch (err) {
      next(err);
    }
  }
}
