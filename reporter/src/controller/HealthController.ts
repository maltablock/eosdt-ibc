import { NextFunction, Request, Response } from "express";

const BLOCKS_IN_10_MINUTES = 2 * 10 * 60;
export default class HealthController {
  async version(request: Request, response: Response, next: NextFunction) {
    try {
      return JSON.stringify({
        // TODO
        last_update: Date.now(),
      });
    } catch (err) {
      next(err);
    }
  }
}
