import { Request, Response } from "express";
import { SessionData, Session } from "express-session";
import { Redis } from "ioredis";
import { createUpdootLoader } from "./utils/createUpdootLoader";
import { createUserLoader } from "./utils/createUserLoader";
// import session from "express-session";

export type MyContext = {
    req: Request & {
        session: Session & Partial<SessionData> & { userId?: number };
    };
    redis: Redis;
    res: Response;
    //ReturnType give return value of a function
    userLoader: ReturnType<typeof createUserLoader>;
    updootLoader: ReturnType<typeof createUpdootLoader>;
};
