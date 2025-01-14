import { Request, Response } from "express";
import { UserService } from "../Services/UserService";
import { IUser, UserModel } from "../Models/UserModel";
import { validationResult } from "express-validator";
import { UserRole } from "../Enums/UserRole";
import { generateTokenWithRole, isEmail } from "../Utils/authUtils";
import { revokedTokens } from "../Middlewares/AuthMiddleware";
import { IAuthenticatedRequest } from "../Types/RequestTypes";
import * as crypto from "crypto";
import {
    sendPasswordResetEmail,
    sendUserVerifiedEmail,
    sendVerificationEmail,
} from "../Utils/emailUtils";
import { logger } from "../logging/logger";
import { NotificationModel } from "../Models/NotificationModel";

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

            const Token = crypto.randomBytes(32).toString("hex");
            const verificationExpire = new Date(Date.now() + 300000);
            const verificationToken = crypto
                .createHash("sha256")
                .update(Token)
                .digest("hex");
            const user = await this.userService.createUser(
                username,
                firstname,
                lastname,
                email,
                password,
                verificationToken,
                verificationExpire,
            );
            const newUser = { ...user.toObject(), password: undefined };
            await sendVerificationEmail(email, verificationToken);
            res.status(201).json({ message: "Signup Successful", newUser });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public verifyUser = async (req: Request, res: Response) => {
        const { token } = req.query;
        try {
            if (!token) {
                return res
                    .status(400)
                    .json({ error: "Verification token is required" });
            }
            const user = await this.userService.getUserByVerificationToken(
                token as string,
            );
            if (!user || user.verificationExpire < new Date()) {
                return res
                    .status(404)
                    .json({ error: "User not found or token expired" });
            }
            await this.userService.verifyUser(user._id.toString());
            await sendUserVerifiedEmail(user.email, user._id.toString());
            res.redirect("https://api.teekect.africa");
        } catch (error) {
            logger.error("Error verifying user:", error);
            res.status(500).json({ error: error.message });
        }
    };

    public reverifyUser = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        const { email } = req.user;
        if (!isEmail(email)) {
            return res.status(400).json({ error: "Invalid email" });
        }
        try {
            const user = await this.userService.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            if (user.isVerified) {
                return res.status(400).json({ error: "User already verified" });
            }
            const currentTime = new Date();
            const verificationExpire = new Date(
                currentTime.getTime() + 5 * 60 * 1000,
            );
            user.verificationExpire = verificationExpire;
            await user.save();
            res.status(200).json({ message: "Verification email sent" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public loginUser = async (req: Request, res: Response) => {
        try {
            const { usernameOrEmail, password } = req.body;
            let user: IUser;

            if (revokedTokens.size > 0) {
                revokedTokens.clear();
            }

            if (usernameOrEmail.includes("@")) {
                user = await this.userService.getUserByEmail(usernameOrEmail);
            } else {
                user =
                    await this.userService.getUserByUsername(usernameOrEmail);
            }
            if (!user) {
                return res
                    .status(401)
                    .json({ error: "Invalid email or username" });
            }
            const isPasswordValid = await user.isValidPassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: "Invalid password" });
            }

            const token = generateTokenWithRole(res, user);
            res.status(200).json({ message: "Login successful", token });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public logoutUser = async (req: Request, res: Response) => {
        try {
            const token =
                req.headers.authorization?.split(" ")[1] ||
                req.cookies.jwt_token;
            if (token) {
                revokedTokens.add(token);
            }
            res.clearCookie("jwt-token");
            res.status(200).json({ message: "Logout successful" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public getAllUsers = async (_req: Request, res: Response) => {
        try {
            const users = await this.userService.getAllUsers();
            res.status(200).json({ users });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public getUserByToken = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        try {
            const { Token } = req.query;
            if (!Token) {
                return res
                    .status(400)
                    .json({ error: "Token is required or missing" });
            }

            const user = await this.userService.getUserByVerificationToken(
                Token as string,
            );
            res.status(200).json({ user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public getUserById = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        try {
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

    public updateUserRole = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }
            const userExists = await this.userService.getUserById(userId);
            if (!userExists) {
                return res
                    .status(404)
                    .json({ error: "This User does not exist" });
            }
            const roleToUpdate = req.body.role.toLowerCase() as UserRole;
            if (!Object.values(UserRole).includes(roleToUpdate)) {
                return res.status(400).json({ error: "Invalid role" });
            }
            if (!roleToUpdate) {
                return res.status(400).json({ error: "Role is required" });
            }

            const notification = new NotificationModel({
                action: "Role Change Request",
                details: `User ID: ${userId} requested a role change to "${roleToUpdate}"`,
                userId: userId,
            });
            await notification.save();
            const updatedUser = await this.userService.updateUserRole(
                userId,
                roleToUpdate,
            );
            if (!updatedUser) {
                return res
                    .status(404)
                    .json({ error: "Error updating user role" });
            }
            res.status(200).json({
                message: "User role updated successfully",
                user: updatedUser, //update this part
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public updateUser = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
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

            if (req.user._id.toString() !== userId) {
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

    public forgotPassword = async (req: Request, res: Response) => {
        try {
            const { email } = req.body;
            const user = await this.userService.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({ error: "User not found forgot" });
            }

            const originalResetToken = crypto.randomBytes(32).toString("hex");
            user.resetPasswordToken = crypto
                .createHash("sha256")
                .update(originalResetToken)
                .digest("hex");
            user.resetPasswordExpire = new Date(Date.now() + 300000);
            await user.save();
            await sendPasswordResetEmail(email, originalResetToken);
            res.status(200).json({
                message: "Password reset token sent to email",
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public resetPassword = async (req: Request, res: Response) => {
        try {
            const { resetToken } = req.body;
            const { password } = req.body;
            if (!resetToken) {
                return res
                    .status(400)
                    .json({ error: "Reset token is required" });
            }
            const resetPasswordToken = crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");
            const user =
                await this.userService.getUserByResetToken(resetPasswordToken);
            if (!user) {
                return res.status(404).json({
                    error: "User not found",
                });
            }

            if (new Date() > user.resetPasswordExpire!) {
                return res
                    .status(400)
                    .json({ error: "Reset token has expired" });
            }
            user.password = password;
            user.resetPasswordToken = null;
            user.resetPasswordExpire = null;
            await user.save();

            res.status(200).json({ message: "Password reset successful" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public changePassword = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        try {
            const { CurrentPassword, NewPassword, ConfirmPassword } = req.body;
            const a = req.user._id.toString();
            if (!CurrentPassword || !NewPassword || !ConfirmPassword) {
                return res
                    .status(400)
                    .json({ error: "All fields are required" });
            }
            const user = await this.userService.getUserById(a);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            const validPassword = await user.isValidPassword(CurrentPassword);
            if (!validPassword) {
                return res
                    .status(400)
                    .json({ error: "Current password is incorrect" });
            }
            if (CurrentPassword === NewPassword) {
                return res
                    .status(400)
                    .json({ error: "New password must be different" });
            }
            if (NewPassword !== ConfirmPassword) {
                return res
                    .status(400)
                    .json({ error: "Passwords do not match" });
            }
            user.password = NewPassword;
            await user.save();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    public deleteUser = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ) => {
        try {
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
