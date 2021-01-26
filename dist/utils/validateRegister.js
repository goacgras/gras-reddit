"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRegister = void 0;
const validateRegister = (userData) => {
    if (userData.username.length <= 2) {
        return [
            {
                field: "username",
                message: "username must be at least 2 character",
            },
        ];
    }
    if (userData.username.includes("@")) {
        return [
            {
                field: "username",
                message: "Cannot include @ sign",
            },
        ];
    }
    if (!userData.email.includes("@")) {
        return [
            {
                field: "email",
                message: "Invalid email",
            },
        ];
    }
    if (userData.password.length <= 3) {
        return [
            {
                field: "password",
                message: "password must be at least 3 character",
            },
        ];
    }
    return null;
};
exports.validateRegister = validateRegister;
//# sourceMappingURL=validateRegister.js.map