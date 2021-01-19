//DATABASE CONNECTION
import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import mikroConfig from "./mikro-orm.config";

//SERVER CONNECTION
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/posts";
import { UserResolver } from "./resolvers/user";

const main = async () => {
    const orm = await MikroORM.init(mikroConfig);
    await orm.getMigrator().up();

    const app = express();

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false,
        }),
        context: () => ({ em: orm.em }),
    });

    //create graphql end point on express
    apolloServer.applyMiddleware({ app });

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
