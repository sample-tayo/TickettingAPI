import { Request, Response } from "express";
import { UserService } from "../Services/UserService";
import { IUser, UserModel } from "../Models/UserModel";
import { validationResult } from "express-validator";
import { UserRole } from "Enums/UserRole";
import { generateTokenWithRole, isEmail } from "../Utils/authUtils";
import { Types } from "mongoose";
import { revokedTokens } from "../Middlewares/AuthMiddleware";
import { IAuthenticatedRequest } from "Types/RequestTypes";

export class UserController {
    private userService: UserService;
    constructor() {
        this.userService = new UserService(UserModel);
    }

    public registerUser = async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, firstname, lastname, email, password } = req.body;

        try {
            if (!this.userService) {
                return res
                    .status(500)
                    .json({ error: "User service is not initialized" });
            }
            const userEmailExists =
                await this.userService.getUserByEmail(email);
            const userUsernameExists =
                await this.userService.getUserByUsername(username);
            if (userUsernameExists) {
                return res
                    .status(409)
                    .json({ error: "username already exists" });
            } else if (userEmailExists) {
                return res.status(409).json({ error: "email already exists" });
            }
            const user = await this.userService.createUser(
                username,
                firstname,
                lastname,
                email,
                password,
            );
            res.status(201).json({ message: "Signup Successful", user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public loginUser = async (req: Request, res: Response) => {
        try {
            const { usernameOrEmail, password } = req.body;
            let user: IUser;
            if (usernameOrEmail.includes("@")) {
                user = await this.userService.getUserByEmail(usernameOrEmail);
            } else {
                user =
                    await this.userService.getUserByUsername(usernameOrEmail);
            }
            if (!user) {
                return res
                    .status(401)
                    .json({ error: "Invalid email or password" });
            }
            const isPasswordValid = await user.isValidPassword(password);
            if (!isPasswordValid) {
                return res
                    .status(401)
                    .json({ error: "Invalid email or password" });
            }
            const role = user.role;
            const token = generateTokenWithRole(res, user, role);
            res.status(200).json({ message: "Login successful", token });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public logoutUser = async (req: Request, res: Response) => {
        try {
            const token = req.cookies.jwt_token;
            if (token) {
                revokedTokens.add(token);
            }
            res.clearCookie("jwt-token");
            res.status(200).json({ message: "Logout successful" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public getAllUsers = async (req: Request, res: Response) => {
        try {
            const users = await this.userService.getAllUsers();
            res.status(200).json({ users });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public getUserById = async (req: IAuthenticatedRequest<IUser>, res: Response) => {
        try {
            const role = req.user.role;
            if (role !== "admin") {
                return res
                    .status(401)
                    .json({ error: "Only Admin can access this route" });
            }

            const userId = req.params.userId;
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }
            const user = await this.userService.getUserById(userId);
            res.status(200).json({ user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public updateUserRole = async (req: IAuthenticatedRequest<IUser>, res: Response) => {
        try {
            const role = req.user.role;
            if (role !== "admin") {
                return res
                    .status(401)
                    .json({ error: "Only Admin can access this route" });
            }

            const userId = req.params.userId;
            const roleToUpdate = req.body.role as UserRole;
            if (roleToUpdate !== "admin" && roleToUpdate !== "user") {
                return res.status(400).json({ error: "Invalid role" });
            }
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }
            if (!roleToUpdate) {
                return res.status(400).json({ error: "Role is required" });
            }
            const updatedUser = await this.userService.updateUserRole(
                userId,
                roleToUpdate,
            );
            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }
            res.status(200).json({
                message: "User role updated successfully",
                user: updatedUser,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public updateUser = async (req: IAuthenticatedRequest<IUser>, res: Response) => {
        try {
            const userId = req.params.userId;
            // let user: IUser;
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }
            const user = await this.userService.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            const userIdObject = new Types.ObjectId(userId);
            if (req.user._id !== userIdObject) {
                return res.status(401).json({
                    error: "You can only edit your own user information",
                });
            }

            const updates: Partial<IUser> = req.body;
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: "No updates provided" });
            }
            if (updates.email && !isEmail(updates.email)) {
                return res.status(400).json({ error: "Invalid email" });
            }

            await this.userService.updateUser(userId, updates);
            const updatedUser = await this.userService.getUserById(userId);
            res.status(200).json({
                message: "User updated successfully",
                updatedUser,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public deleteUser = async (req: IAuthenticatedRequest<IUser>, res: Response) => {
        try {
            const role = req.user.role;
            if (role !== "admin") {
                return res
                    .status(401)
                    .json({ error: "Only Admin can access this route" });
            }
            const userId = req.params.userId;
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }
            const user = await this.userService.deleteUser(userId);
            res.status(200).json({
                message: "User deleted successfully",
                user,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };
}
