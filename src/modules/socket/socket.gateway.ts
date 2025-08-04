import {
  WebSocketGateway,
  OnGatewayConnection,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from '@/modules/socket/types/authenticated-socket.interface';
import { Optional, Session, UserSession } from '@thallesp/nestjs-better-auth';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SocketGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor() {}

  @Optional()
  async handleConnection(
    client: AuthenticatedSocket,
    @Session() session: UserSession,
  ) {
    client.session = session;
    client.emit('session.info', session);
  }
}
