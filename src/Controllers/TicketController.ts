import { Request, Response } from "express";
import { TicketModel, ITicket } from "../Models/TicketModel";
import { TicketService } from "../Services/TicketService";
import { validationResult } from "express-validator";
import { EventService } from "../Services/EventService";
import { UserService } from "../Services/UserService";
import { UserModel } from "../Models/UserModel";
import { EventModel } from "../Models/EventModel";

export class TicketController {
    private ticketService: TicketService;
    private eventService: EventService;
    private userService: UserService;

    constructor() {
        this.ticketService = new TicketService(TicketModel);
        this.eventService = new EventService(EventModel);
        this.userService = new UserService(UserModel);
    }

    public getAllTickets = async (
        _req: Request,
        res: Response,
    ): Promise<Response<ITicket[] | []>> => {
        try {
            const tickets = await this.ticketService.getAllTickets();
            return res.status(200).json({ tickets });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getTicketById = async (
        req: Request,
        res: Response,
    ): Promise<Response<ITicket | null>> => {
        try {
            const ticketId = req.params.ticketId;
            const ticket = await this.ticketService.getTicketById(ticketId);
            if (ticket == null) {
                return res
                    .status(404)
                    .json({ error: "Ticket does not exists" });
            }
            return res.status(200).json(ticket);
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getEventTickets = async (
        req: Request & { eventId: string },
        res: Response,
    ): Promise<Response<ITicket[] | []>> => {
        try {
            const { eventId } = req.params;
            const event = await this.eventService.getEventById({ eventId });
            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            const tickets = await this.ticketService.getEventTickets(eventId);
            return res.status(200).json({ tickets });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getUserEventTicket = async (
        req: Request & { eventId: string; userId: string },
        res: Response,
    ): Promise<Response<ITicket[] | []>> => {
        try {
            const { eventId, userId } = req.params;
            const event = await this.eventService.getEventById({ eventId });
            const user = await this.userService.getUserById(userId);

            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            if (user == null) {
                return res.status(404).json({ error: "User does not exists" });
            }

            const tickets = await this.ticketService.getUserEventTicket(
                userId,
                eventId,
            );
            return res.status(200).json({ tickets });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public createTicket = async (
        req: Request,
        res: Response,
    ): Promise<Response<ITicket>> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const newTicket = await this.ticketService.createTicket(req.body);
            res.status(201).json({ ticket: newTicket });
        } catch (error) {
            res.status(500).json(error);
        }
    };

    public updateTicketById = async (
        req: Request & { ticketId: string },
        res: Response,
    ): Promise<Response<ITicket | null>> => {
        try {
            const { ticketId } = req.params;

            const ticket = await this.ticketService.getTicketById(ticketId);
            if (ticket == null) {
                return res
                    .status(404)
                    .json({ error: "Ticket does not exists" });
            }

            const ticketUpdate = {
                ...req.body,
                eventId: ticket.eventId,
                userId: ticket.userId,
            };
            const updatedTicket = await this.ticketService.updateTicketById(
                ticketId,
                ticketUpdate,
            );
            return res.status(200).json({ ticket: updatedTicket });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public updateTicketByEventIdAndUserId = async (
        req: Request & { ticketId: string; eventId: string; userId: string },
        res: Response,
    ): Promise<Response<ITicket | null>> => {
        try {
            const { ticketId, userId, eventId } = req.params;
            const event = await this.eventService.getEventById({ eventId });
            const user = await this.userService.getUserById(userId);
            const ticket = await this.ticketService.getTicketById(ticketId);

            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            if (user == null) {
                return res.status(404).json({ error: "User does not exists" });
            }
            if (ticket == null) {
                return res
                    .status(404)
                    .json({ error: "Ticket does not exists" });
            }

            const ticketUpdate = {
                ...req.body,
                eventId: ticket.eventId,
                userId: ticket.userId,
            };
            const updatedTicket =
                await this.ticketService.updateTicketByEventIdAndUserId(
                    eventId,
                    userId,
                    ticketUpdate,
                );
            return res.status(200).json({ ticket: updatedTicket });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public deleteTicketById = async (
        req: Request & { ticketId: string },
        res: Response,
    ): Promise<Response<null>> => {
        try {
            const { ticketId } = req.params;
            const ticket = await this.ticketService.getTicketById(ticketId);
            if (ticket == null) {
                return res
                    .status(404)
                    .json({ error: "Ticket does not exists" });
            }
            await this.ticketService.deleteTicketById(ticketId);
            return res.status(204).json();
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public deleteTicketByEventIdAndUserId = async (
        req: Request & { ticketId: string; eventId: string; userId: string },
        res: Response,
    ): Promise<Response<ITicket | null>> => {
        try {
            const { ticketId, userId, eventId } = req.params;

            const event = await this.eventService.getEventById({ eventId });
            const user = await this.userService.getUserById(userId);
            const ticket = await this.ticketService.getTicketById(ticketId);

            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            if (user == null) {
                return res.status(404).json({ error: "User does not exists" });
            }
            if (ticket == null) {
                return res
                    .status(404)
                    .json({ error: "Ticket does not exists" });
            }

            await this.ticketService.deleteTicketByEventIdAndUserId(
                eventId,
                userId,
            );
            return res.status(200).json();
        } catch (error) {
            return res.status(500).json(error);
        }
    };
}
