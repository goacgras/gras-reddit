import { Post } from "../entities/Post";
import { Arg, Mutation, Query, Resolver } from "type-graphql";

// const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

@Resolver()
export class PostResolver {
    @Query(() => [Post])
    posts(): Promise<Post[]> {
        // await sleep(3000);
        return Post.find();
    }

    @Query(() => Post, { nullable: true })
    post(@Arg("id") id: number): Promise<Post | undefined> {
        return Post.findOne(id);
    }

    @Mutation(() => Post)
    async createPost(@Arg("title") title: string): Promise<Post> {
        return Post.create({ title }).save();
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
