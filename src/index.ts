//DATABASE CONNECTION
import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import { createConnection } from "typeorm";

//SERVER CONNECTION
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/posts";
import { UserResolver } from "./resolvers/user";

import Redis from "ioredis";
// import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import cors from "cors";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
// import { sendEmail } from "./utils/sendEmail";
// import { User } from "./entities/User";

const main = async () => {
    // sendEmail("reza@mail.com", "sup").catch(console.error);
    const conn = await createConnection({
        type: "postgres",
        database: "gras-reddit-typeorm",
        username: "postgres",
        password: "root",
        logging: true,
        synchronize: true,
        entities: [Post, User],
    });

    const app = express();

    const RedisStore = connectRedis(session);
    const redis = new Redis();
    // const redisClient = redis.createClient();

    app.use(cors({ origin: "http://localhost:3000", credentials: true }));
    app.use(
        session({
            name: COOKIE_NAME,
            store: new RedisStore({
                client: redis as any,
                disableTouch: true,
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
                httpOnly: true, //cant access cookie in front end
                sameSite: "lax", // csrf
                secure: __prod__, //cookie only works in https
            },
            saveUninitialized: false, //
            secret: "goacgrasisthebest",
            resave: false,
        })
    );

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false,
        }),
        context: ({ req, res }): MyContext => ({ req, res, redis }),
    });

    //create graphql end point on express
    apolloServer.applyMiddleware({ app, cors: false });

    app.listen(5000, () => {
        console.log("Server started at localhost:5000");
    });
};

main().catch((err) => {
    console.error(err);
});
