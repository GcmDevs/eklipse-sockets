import { promises as fs } from 'fs';
import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatMessage,
  RegisteredChatUser,
  SendChatMessagePayload,
} from '@socket/chat/domain/types';
import { ChatReplyMessageNotFoundError } from '@socket/chat/domain/types';
import { SOCKET_EVENTS } from '@common/application/events';
import {
  FILE_PATHS,
  MAX_CHAT_FILES_PER_MESSAGE,
  isManagedStoredFilePath,
  normalizeStoredFilePath,
  resolveStoredPublicFile,
} from '@file-saver/locations';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class SendMessageImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: SendChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.rejectedMessage('No fue posible identificar tu sesión.');
    if (this.isChatLocked(client)) return this.chatLocked(true);
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const rawAttachments = payload?.attachments;
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.map(value =>
          typeof value === 'string' ? normalizeStoredFilePath(value) : ''
        )
      : [];
    const rawReplyToMessageId = payload?.replyToMessageId;
    const replyToMessageId =
      rawReplyToMessageId === undefined || rawReplyToMessageId === null
        ? undefined
        : Number(rawReplyToMessageId);

    if (!payload.conversationId) return this.rejectedMessage('Selecciona una conversación.');
    if (rawAttachments !== undefined && !Array.isArray(rawAttachments)) {
      return this.rejectedMessage('Los archivos adjuntos no son válidos.');
    }
    if (attachments.length > MAX_CHAT_FILES_PER_MESSAGE) {
      return this.rejectedMessage(
        `Solo puedes enviar hasta ${MAX_CHAT_FILES_PER_MESSAGE} archivos por mensaje.`
      );
    }
    if (
      attachments.some(path => !isManagedStoredFilePath(path, FILE_PATHS.chat.files)) ||
      new Set(attachments).size !== attachments.length
    ) {
      return this.rejectedMessage('Los archivos adjuntos no son válidos.');
    }
    if (
      replyToMessageId !== undefined &&
      (!Number.isSafeInteger(replyToMessageId) || replyToMessageId <= 0)
    ) {
      return this.rejectedMessage('El mensaje que intentas responder no es válido.');
    }
    if (!content && attachments.length === 0) {
      return this.rejectedMessage('Escribe un mensaje o adjunta un archivo antes de enviarlo.');
    }
    if (content.length > this.MAX_MESSAGE_LENGTH) {
      return this.rejectedMessage(
        `El mensaje no puede superar ${this.MAX_MESSAGE_LENGTH} caracteres.`
      );
    }

    try {
      await Promise.all(attachments.map(path => fs.access(resolveStoredPublicFile(path))));

      const participants = await this.store.participants(payload.conversationId);
      if (!participants.some(participant => participant.id === currentUser.id)) {
        return this.rejectedMessage('No tienes acceso a esta conversación.');
      }

      const registeredParticipants = await this.directory.findByIds(
        participants.map(participant => participant.id)
      );
      if (registeredParticipants.length !== 2) {
        return this.rejectedMessage(
          'No se puede enviar el mensaje porque uno de los usuarios ya no está registrado.'
        );
      }

      const registeredCurrentUser = registeredParticipants.find(
        participant => participant.id === currentUser.id
      );
      if (!registeredCurrentUser || registeredCurrentUser.document !== currentUser.document) {
        return this.rejectedMessage('Tu usuario ya no está registrado para utilizar el chat.');
      }

      if (attachments.length && !this.fileRegistry.reserve(attachments, currentUser.document)) {
        return this.rejectedMessage('Los archivos adjuntos ya no están disponibles.');
      }

      const message = await this.store.addMessage(
        payload.conversationId,
        registeredCurrentUser,
        content,
        attachments,
        replyToMessageId
      );
      if (!message) {
        this.fileRegistry.release(attachments, currentUser.document);
        return this.rejectedMessage('No tienes acceso a esta conversación.');
      }

      this.fileRegistry.complete(attachments, currentUser.document);

      await this.emitConversationUpdate(payload.conversationId);
      await Promise.all(
        registeredParticipants.map(participant =>
          this.emitToUnlockedUser(participant.document, SOCKET_EVENTS.chat.message, message)
        )
      );

      return { ok: true, data: message };
    } catch (error) {
      this.fileRegistry.release(attachments, currentUser.document);
      if (error instanceof ChatReplyMessageNotFoundError) {
        return this.rejectedMessage(
          'El mensaje que intentas responder ya no está disponible en esta conversación.'
        );
      }
      this.logPersistenceError('guardar un mensaje', error);
      return this.rejectedMessage('No fue posible guardar el mensaje. Intenta nuevamente.');
    }
  }
}
