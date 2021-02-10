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

    @Query(() => PaginatedPosts)
    async posts(
        @Arg("limit", () => Int) limit: number,
        //if nullable set the types
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null
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
            select p.*,
            json_build_object(
                'id', u.id,
                'username', u.username, 
                'email', u.email,
                'createdAt', u."createdAt",
                'updatedAt', u."updatedAt"
            ) creator
            from posts p
            join users u
                on p."creatorId" = u.id
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
    post(@Arg("id") id: number): Promise<Post | undefined> {
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
    async updatePost(
        @Arg("id") id: number,
        @Arg("title", () => String, { nullable: true }) title: string
    ): Promise<Post | null> {
        const post = await Post.findOne(id);
        if (!post) {
            return null;
        }
        if (typeof title !== "undefined") {
            Post.update({ id }, { title });
        }

        return post;
    }
    @Mutation(() => String)
    async deletePost(@Arg("id") id: number): Promise<boolean> {
        try {
            const post = await Post.findOneOrFail(id);
            post.remove();
            return true;
        } catch {
            return false;
        }
    }
}
