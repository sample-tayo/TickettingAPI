import { IEventPaginationAndSort } from "../Types/RequestTypes";
import { IEvent } from "../Models/EventModel";
import { Model, Query } from "mongoose";
import { EventStatus } from "../Enums/EventStatus";
import { EventTicketTypeService } from "./EventTicketTypeService";
import { EventTicketTypeModel } from "../Models/EventTicketTypeModel";

export class EventService {
    private eventTicketTypeService: EventTicketTypeService;
    constructor(public eventModel: Model<IEvent>) {
        this.eventTicketTypeService = new EventTicketTypeService(
            EventTicketTypeModel,
        );
    }

    async getAllEventsCount(): Promise<number> {
        return this.eventModel.countDocuments();
    }

    async getAllEvents({
        page,
        perPage,
        sort,
        order,
        status = EventStatus.Approved,
        organizerId,
        fieldsToSelect,
    }: IEventPaginationAndSort): Promise<IEvent[] | []> {
        let events;
        if (sort === "latest") {
            events = this.getAllLatestEvents({
                order,
                page,
                perPage,
                status,
            });
        } else if (sort === "popularity") {
            events = this.getAllPopularEvents({
                order,
                page,
                perPage,
                status,
            });
        } else {
            events = this.eventModel
                .find({ status })
                .limit(perPage)
                .skip((page - 1) * perPage);
        }

        if (organizerId) {
            events = events.where({ organizerId });
        }

        return events.select(fieldsToSelect);
    }

    createEvent({
        name,
        description,
        category,
        status,
        visibility,
        location,
        venueType,
        organizerId,
        startDate,
        endDate,
        media,
        tags,
    }: IEvent): IEvent {
        return new this.eventModel({
            name,
            description,
            category,
            status,
            visibility,
            location,
            venueType,
            organizerId,
            startDate,
            endDate,
            media,
            tags,
        });
    }

    getAllLatestEvents({
        order = "desc",
        page,
        perPage,
        status,
    }: IEventPaginationAndSort): Query<IEvent[], IEvent> {
        return this.eventModel
            .find({ status })
            .sort({ createdAt: order })
            .limit(perPage)
            .skip((page - 1) * perPage);
    }

    getAllPopularEvents({
        order = "desc",
        page,
        perPage,
        status,
    }: IEventPaginationAndSort): Query<IEvent[], IEvent> {
        return this.eventModel
            .find({ status })
            .sort({
                totalTickets: order,
            })
            .limit(perPage)
            .skip((page - 1) * perPage);
    }

    async getEventById({
        eventId,
        status,
    }: {
        eventId: string;
        status?: string;
    }): Promise<IEvent | null> {
        if (status == undefined) {
            return this.eventModel.findOne({ _id: eventId });
        }
        return this.eventModel.findOne({ _id: eventId, status });
    }

    async updateEventById(
        eventId: string,
        eventUpdate: Partial<IEvent>,
    ): Promise<IEvent | null> {
        return this.eventModel.findByIdAndUpdate(eventId, eventUpdate, {
            new: true,
        });
    }

    async deleteEventById(eventId: string): Promise<null> {
        await this.eventTicketTypeService.deleteEventTicketTypesByEventId(
            eventId,
        );
        return this.eventModel.findByIdAndDelete(eventId);
    }
}
