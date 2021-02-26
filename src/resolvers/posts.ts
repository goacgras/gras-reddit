import { Post } from "../entities/Post";
import {
    Arg,
    Ctx,
    Field,
    FieldResolver,
    InputType,
    Int,
    Mutation,
    ObjectType,
    Query,
    Resolver,
    Root,
    UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";
// import { Updoot } from "../entities/Updoot";

// const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

@InputType()
class PostInput {
    @Field()
    title: string;
    @Field()
    text: string;
}

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[];
    @Field()
    hasMore: boolean;
}
//
@Resolver(Post)
export class PostResolver {
    //Not in database, we create and send to client
    @FieldResolver(() => String)
    textSnippet(@Root() root: Post) {
        return root.text.slice(0, 50);
    }
    @FieldResolver(() => User)
    creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
        // return User.findOne(post.creatorId);
        return userLoader.load(post.creatorId);
    }
    @FieldResolver(() => Int, { nullable: true })
    async voteStatus(
        @Root() post: Post,
        @Ctx() { updootLoader, req }: MyContext
    ) {
        if (!req.session.userId) {
            return null;
        }

        const updoot = await updootLoader.load({
            postId: post.id,
            userId: req.session.userId,
        });
        return updoot ? updoot.value : null;
    }

    @Query(() => PaginatedPosts)
    async posts(
        @Arg("limit", () => Int) limit: number,
        //if nullable set the types
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null
        // @Ctx() { req }: MyContext
    ): Promise<PaginatedPosts> {
        //user ask 20 => fetching 21
        const realLimit = Math.min(50, limit);
        const realLimitPlusOne = realLimit + 1;

        const replacements: any[] = [realLimitPlusOne];

        if (cursor) {
            replacements.push(new Date(parseInt(cursor)));
        }

        const posts = await getConnection().query(
            `
            select p.*
            from posts p
            ${cursor ? `where p."createdAt" < $2 ` : ""}
            order by p."createdAt" desc 
            limit $1
        `,
            replacements
        );

        // const qb = getConnection()
        //     .getRepository(Post)
        //     .createQueryBuilder("p")
        //     .leftJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
        //     .orderBy('p."createdAt"', "DESC") // PUT QUOTATION!!
        //     .take(realLimitPlusOne);

        // if (cursor) {
        //     qb.where('p."createdAt" < :cursor', {
        //         cursor: new Date(parseInt(cursor)),
        //     });
        // }

        // const posts = await qb.getMany();

        return {
            //slice it so give user what they ask
            posts: posts.slice(0, realLimit),
            hasMore: posts.length === realLimitPlusOne,
        };
    }

    @Query(() => Post, { nullable: true })
    post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
        return Post.findOne(id);
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg("postId", () => Int) postId: number,
        @Arg("value", () => Int) value: number,
        @Ctx() { req }: MyContext
    ) {
        const { userId } = req.session;
        const isUpdoot = value !== -1;
        const realValue = isUpdoot ? 1 : -1;
        const updoot = await Updoot.findOne({ where: { postId, userId } });

        // await Updoot.insert({
        //     postId,
        //     userId,
        //     value: realValue,
        // });

        //user has voted & changing the vote
        if (updoot && updoot.value !== realValue) {
            await getConnection().transaction(async (tm) => {
                //update value from 1 to -1
                await tm.query(
                    `
                update updoots 
                set value = $1
                where "postId" = $2 and "userId" = $3
                `,
                    [realValue, postId, userId]
                );

                //set the points on post
                await tm.query(
                    `
                
                update posts 
                set points = points + $1
                where id = $2

                `,
                    [2 * realValue, postId]
                );
            });
        } else if (!updoot) {
            //has never voted before
            await getConnection().transaction(async (tm) => {
                await tm.query(
                    `
                insert into updoots ("userId", "postId", value)
                values($1, $2, $3)
    
                `,
                    [userId, postId, realValue]
                );

                await tm.query(
                    `
                update posts 
                set points = points + $1
                where id = $2
                `,
                    [realValue, postId]
                );
            });
        }

        // await getConnection().query(
        //     `
        //     START TRANSACTION;

        //     insert into updoots ("userId", "postId", value)
        //     values(${userId}, ${postId}, ${realValue});

        //     update posts
        //     set points = points + ${realValue}
        //     where id = ${postId};

        //     COMMIT;
        // `
        // );

        return true;
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg("input") input: PostInput,
        @Ctx() { req }: MyContext
    ): Promise<Post> {
        return Post.create({
            ...input,
            creatorId: req.session.userId,
        }).save();
    }

    @Mutation(() => Post, { nullable: true })
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg("id", () => Int) id: number,
        @Arg("title") title: string,
        @Arg("text") text: string,
        @Ctx() { req }: MyContext
    ): Promise<Post | null> {
        const result = await getConnection()
            .createQueryBuilder()
            .update(Post)
            .set({
                text,
                title,
            })
            .where('id = :id and "creatorId" = :creatorId', {
                id,
                creatorId: req.session.userId,
            })
            .returning("*") //returning the post that we updated
            .execute();

        return result.raw[0];
        //   return Post.update({id, creatorId: req.session.userId }, {title, text})
    }
    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async deletePost(
        @Arg("id", () => Int) id: number, // by default this is a float change to Int
        @Ctx() { req }: MyContext
    ): Promise<boolean> {
        //NOT CASCADE WAY
        // try {
        //     const post = await Post.findOneOrFail(id);
        //     if (post.creatorId !== req.session.userId) {
        //         throw new Error("Unauthorized");
        //     }
        //     await Updoot.delete({ postId: id });
        //     post.remove();
        //     return true;
        // } catch {
        //     return false;
        // }

        //CASCADE WAY check updoot entity
        await Post.delete({ id, creatorId: req.session.userId });
        return true;
    }
}
