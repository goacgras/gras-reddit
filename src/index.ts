//DATABASE CONNECTION
import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { COOKIE_NAME, __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import mikroConfig from "./mikro-orm.config";

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
import { sendEmail } from "./utils/sendEmail";
// import { User } from "./entities/User";

const main = async () => {
    sendEmail("reza@mail.com", "sup").catch(console.error);
    const orm = await MikroORM.init(mikroConfig);
    // await orm.em.nativeDelete(User, {});
    await orm.getMigrator().up();

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
        context: ({ req, res }): MyContext => ({ em: orm.em, req, res, redis }),
    });

    //create graphql end point on express
    apolloServer.applyMiddleware({ app, cors: false });

    app.listen(5000, () => {
        console.log("Server started at localhost:5000");
    });

    // const post = orm.em.create(Post, { title: "my first post" });
    // await orm.em.persistAndFlush(post);

    // const posts = await orm.em.find(Post, {});
    // console.log(posts);
};

main().catch((err) => {
    console.error(err);
});
