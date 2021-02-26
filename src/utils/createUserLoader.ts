import DataLoader from "dataloader";
import { User } from "../entities/User";

//[1,56,7,2]
//[{id: 1, username:'john}, ...]
export const createUserLoader = () =>
    new DataLoader<number, User>(async (userIds) => {
        const users = await User.findByIds(userIds as number[]);
        const userIdToUser: Record<number, User> = {};
        users.forEach((user) => {
            userIdToUser[user.id] = user;
        });
        const sorterUsers = userIds.map((userId) => userIdToUser[userId]);
        console.log("userIds: ", userIds);
        console.log("map: ", userIdToUser);
        console.log("sortedUsers: ", sorterUsers);

        return sorterUsers;
    });
