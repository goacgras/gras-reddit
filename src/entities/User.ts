//@Field is expose entity
// import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import {
    PrimaryGeneratedColumn,
    Entity,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BaseEntity,
    OneToMany,
} from "typeorm";
import { Field, ObjectType } from "type-graphql";
import { Post } from "./Post";

@ObjectType()
@Entity("users")
export class User extends BaseEntity {
    @Field()
    @PrimaryGeneratedColumn()
    id!: number;

    @Field()
    @Column({ unique: true })
    username!: string;

    @Field()
    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string;

    @OneToMany(() => Post, (post) => post.creator)
    posts: Post[];

    @Field(() => String)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => String)
    @UpdateDateColumn()
    updatedAt: Date;
}
