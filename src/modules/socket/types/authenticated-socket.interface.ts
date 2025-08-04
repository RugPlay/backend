import { UserSession } from "@thallesp/nestjs-better-auth";
import { Socket } from "socket.io";

export interface AuthenticatedSocket extends Socket {
  session: UserSession;
}
