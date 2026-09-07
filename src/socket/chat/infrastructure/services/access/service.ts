import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { switchSocketsConn } from '@common/infrastructure/services';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';
import { ChatAccessPolicyOrm } from '../../orm/access-policy.orm';
import { ChatAccessContactOrm } from '../../orm/access-contact.orm';
import { ChatAccessLinkOrm } from '../../orm/access-link.orm';
import { chatAccessPredicate } from './predicate';

export interface ChatAccessPolicy {
  incomingRestricted: boolean;
  contactsRestricted: boolean;
  discoverAll: boolean;
}

@Injectable()
export class ChatAccessService {
  async canContact(
    actorId: number,
    targetId: number,
    manager: EntityManager = switchSocketsConn().manager
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(actorId) ||
      !Number.isSafeInteger(targetId) ||
      actorId <= 0 ||
      targetId <= 0 ||
      actorId === targetId
    )
      return false;
    return manager
      .getRepository(SocketUserOrm)
      .createQueryBuilder('target')
      .where('target.id = :targetId', { targetId })
      .andWhere('EXISTS (SELECT 1 FROM "CHATUSUREG" actor WHERE actor."OID" = :actorId)', {
        actorId,
      })
      .andWhere(chatAccessPredicate(':actorId', '"target"."OID"'))
      .getExists();
  }

  /** Call only after persisting an authorized message, using that same transaction. */
  async linkAfterMessage(actorId: number, targetId: number, manager: EntityManager): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ChatAccessLinkOrm)
      .values({
        firstUserId: Math.min(actorId, targetId),
        secondUserId: Math.max(actorId, targetId),
        createdAt: new Date(),
      })
      .orIgnore()
      .execute();
  }

  /** Trusted application entry point. Do not expose it to ordinary chat sockets. */
  async configure(
    userId: number,
    policy: ChatAccessPolicy,
    contactUserIds: readonly number[],
    manager?: EntityManager
  ): Promise<void> {
    const contacts = [...new Set(contactUserIds)];
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      contacts.some(id => !Number.isSafeInteger(id) || id <= 0 || id === userId)
    ) {
      throw new Error('Invalid chat access users');
    }
    if (
      ['incomingRestricted', 'contactsRestricted', 'discoverAll'].some(
        key => typeof policy?.[key] !== 'boolean'
      )
    ) {
      throw new Error('Invalid chat access policy');
    }
    const persist = async (manager: EntityManager) => {
      await manager.getRepository(ChatAccessPolicyOrm).save({
        userId,
        incomingRestricted: policy.incomingRestricted,
        contactsRestricted: policy.contactsRestricted,
        discoverAll: policy.discoverAll,
      });
      await manager.getRepository(ChatAccessContactOrm).delete({ userId });
      if (contacts.length)
        await manager
          .getRepository(ChatAccessContactOrm)
          .insert(contacts.map(contactUserId => ({ userId, contactUserId })));
    };
    if (manager) await persist(manager);
    else await switchSocketsConn().transaction('SERIALIZABLE', persist);
  }

  async revokeLink(firstId: number, secondId: number): Promise<void> {
    if (
      ![firstId, secondId].every(id => Number.isSafeInteger(id) && id > 0) ||
      firstId === secondId
    )
      throw new Error('Invalid chat link');
    await switchSocketsConn()
      .getRepository(ChatAccessLinkOrm)
      .delete({
        firstUserId: Math.min(firstId, secondId),
        secondUserId: Math.max(firstId, secondId),
      });
  }
}
