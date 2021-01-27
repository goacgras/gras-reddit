import { User } from "../entities/User";
import { MyContext } from "../../src/types";
import {
    Arg,
    Resolver,
    Mutation,
    Field,
    Ctx,
    ObjectType,
    Query,
} from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
    @Field()
    field: string;
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[];

    @Field(() => User, { nullable: true })
    user?: User;
}

@Resolver()
export class UserResolver {
    @Query(() => User, { nullable: true })
    async me(@Ctx() { req, em }: MyContext) {
        // console.log(req.session);
        if (!req.session.userId) {
            return null;
        }

        const user = await em.findOne(User, { id: req.session.userId });
        return user;
    }

    @Query(() => User, { nullable: true })
    async users(@Ctx() { em }: MyContext): Promise<User[]> {
        const users = await em.find(User, {});
        // console.log(users);
        return users;
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('token') token : string,
        @Arg('newPassword') newPassword : string
        @Ctx() {redis, em, req}:MyContext
    ) : Promise<UserResponse> {
        if(newPassword.length <= 2){
            return { 
                errors: [
                    {
                        field: "newPassword",
                        message: "Length must be greater than 2"
                    }
                ]
            }
        }
        const key = FORGET_PASSWORD_PREFIX + token
        const userId = await redis.get(key)
        if(!userId){
            return {
                errors:[
                    {
                        field: 'token',
                        message: "Invalid token"
                    }
                ]
            }
        }

        const user = await em.findOne(User, { id: parseInt(userId)})

        if(!user){
            return {
                errors:[
                    {
                        field: 'token',
                        message: "User no longer exists"
                    }
                ]
            }
        }
        user.password = await argon2.hash(newPassword);
        await em.persistAndFlush(user);

        redis.del(key);

        //login user after change password
        req.session.userId = user.id;

        return { user };

    }

    @Mutation(() => UserResponse)
    async register(
        @Arg("userData") userData: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const errors = validateRegister(userData);
        if (errors) return { errors };

        const hashedPassword = await argon2.hash(userData.password);
        const user = em.create(User, {
            username: userData.username,
            password: hashedPassword,
            email: userData.email,
        });
        try {
            await em.persistAndFlush(user);
            req.session.userId = user.id;
            return {
                user,
            };
        } catch (err) {
            //duplicate username error
            //|| err.detail.includes("already exists")
            if (err.code === "23505") {
                return {
                    errors: [
                        {
                            field: "username",
                            message: "Username already exist",
                        },
                    ],
                };
            }

            return {
                errors: [
                    {
                        field: "general",
                        message: "Something went wrong",
                    },
                ],
            };
        }
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("usernameOrEmail") usernameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const user = await em.findOne(
            User,
            usernameOrEmail.includes("@")
                ? { email: usernameOrEmail }
                : { username: usernameOrEmail }
        );
        if (usernameOrEmail.trim() === "") {
            return {
                errors: [
                    {
                        field: "usernameOrEmail",
                        message: "Username must not be empty",
                    },
                ],
            };
        }
        if (password.trim() === "") {
            return {
                errors: [
                    {
                        field: "password",
                        message: "Password must not be empty",
                    },
                ],
            };
        }

        if (!user) {
            return {
                errors: [
                    {
                        field: "usernameOrEmail",
                        message: "User not found",
                    },
                ],
            };
        }

        const validPassword = await argon2.verify(user.password, password);
        if (!validPassword) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "Wrong Password",
                    },
                ],
            };
        }
        //Store userId Session, set a cookie on user
        //kept them logged in
        req.session.userId = user.id;
        return {
            user,
        };
    }

    @Mutation(() => Boolean)
    logout(@Ctx() { req, res }: MyContext) {
        return new Promise((resolve) =>
            req.session.destroy((err) => {
                if (err) {
                    resolve(false);
                    return;
                }
                res.clearCookie(COOKIE_NAME);
                resolve(true);
            })
        );
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() { em, redis }: MyContext
    ) {
        const user = await em.findOne(User, { email });
        if (!user) {
            //email not in database
            return true;
        }

        const token = v4();
        await redis.set(
            FORGET_PASSWORD_PREFIX + token,
            user.id, //stored value
            "ex", // expires
            1000 * 60 * 60 * 24 * 3 // 3 days
        );
        await sendEmail(
            email,
            `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
        );

        return true;
    }
}
