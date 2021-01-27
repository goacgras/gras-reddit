import { Request, Response } from "express";
import { SessionData, Session } from "express-session";
import { Redis } from "ioredis";
// import session from "express-session";

export type MyContext = {
    req: Request & {
        session: Session & Partial<SessionData> & { userId?: number };
    };
    redis: Redis;
    res: Response;
};
