import { NextFunction, Request, Response } from "express";
import { readFileSync } from "fs";
import { getLogFilePath } from "../logger";

export default class LogsController {
  async logs(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = readFileSync(getLogFilePath(), `utf8`)

      return `<pre>${logs}</pre>`
    } catch (err) {
      next(err);
    }
  }
}
