import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { In } from 'typeorm';
import { switchSocketsConn } from '@common/infrastructure/services';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';
import { ChatAccessContactOrm, ChatAccessLinkOrm, ChatAccessPolicyOrm } from '../../orm';
import { ChatAccessPolicy, ChatAccessService } from './service';

const publicUser = (user: SocketUserOrm) => ({
  id: user.id,
  document: user.document,
  name: user.fullName,
  typeCode: user.typeCode,
});

@Injectable()
export class ManageChatAccessService {
  constructor(private readonly access: ChatAccessService) {}

  async search(query: string, page: number, typeCode?: number) {
    const term = query.trim().replace(/[!%_]/g, value => `!${value}`);
    const builder = switchSocketsConn().getRepository(SocketUserOrm).createQueryBuilder('user');
    if (term)
      builder.where(
        "(user.document ILIKE :term ESCAPE '!' OR user.fullName ILIKE :term ESCAPE '!')",
        { term: `%${term}%` }
      );
    if (typeCode !== undefined) builder.andWhere('user.typeCode = :typeCode', { typeCode });
    const [users, total] = await builder
      .orderBy('user.fullName', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * 20)
      .take(20)
      .getManyAndCount();
    return { users: users.map(publicUser), total, page, pageSize: 20 };
  }

  async details(userId: number, manager = switchSocketsConn().manager) {
    const user = await this.requireUser(userId, manager);
    const [policy, contacts, links] = await Promise.all([
      manager.getRepository(ChatAccessPolicyOrm).findOneBy({ userId }),
      manager
        .getRepository(ChatAccessContactOrm)
        .find({ where: { userId }, relations: ['contact'], order: { contactUserId: 'ASC' } }),
      manager.getRepository(ChatAccessLinkOrm).find({
        where: [{ firstUserId: userId }, { secondUserId: userId }],
        relations: ['firstUser', 'secondUser'],
        order: { createdAt: 'DESC' },
      }),
    ]);
    const values: ChatAccessPolicy = {
      incomingRestricted: policy?.incomingRestricted ?? false,
      contactsRestricted: policy?.contactsRestricted ?? false,
      discoverAll: policy?.discoverAll ?? false,
    };
    return {
      user: publicUser(user),
      policy: values,
      contacts: contacts.map(row => publicUser(row.contact)),
      links: links.map(row => ({
        user: publicUser(row.firstUserId === userId ? row.secondUser : row.firstUser),
        createdAt: new Date(row.createdAt).toISOString(),
      })),
      revision: createHash('sha256')
        .update(JSON.stringify([values, contacts.map(row => row.contactUserId)]))
        .digest('hex'),
    };
  }

  async update(
    userId: number,
    policy: ChatAccessPolicy,
    contactUserIds: number[],
    revision: string
  ) {
    if (contactUserIds.includes(userId))
      throw new BadRequestException('No puedes asignar al usuario como su propio contacto.');
    try {
      return await switchSocketsConn().transaction('SERIALIZABLE', async manager => {
        const current = await this.details(userId, manager);
        if (current.revision !== revision)
          throw new ConflictException(
            'La configuración cambió. Recarga el usuario antes de guardar.'
          );
        if (contactUserIds.length) {
          const count = await manager
            .getRepository(SocketUserOrm)
            .countBy({ id: In(contactUserIds) });
          if (count !== contactUserIds.length)
            throw new BadRequestException('Uno de los contactos ya no está registrado.');
        }
        await this.access.configure(userId, policy, contactUserIds, manager);
        return this.details(userId, manager);
      });
    } catch (error: any) {
      if (error?.driverError?.code === '40001' || error?.driverError?.code === '40P01')
        throw new ConflictException(
          'Otro administrador modificó estas relaciones. Recarga e intenta nuevamente.'
        );
      throw error;
    }
  }

  async revokeLink(userId: number, contactId: number) {
    if (userId === contactId) throw new BadRequestException('Los usuarios deben ser diferentes.');
    await Promise.all([this.requireUser(userId), this.requireUser(contactId)]);
    await this.access.revokeLink(userId, contactId);
    return { success: true };
  }

  private async requireUser(userId: number, manager = switchSocketsConn().manager) {
    const user = await manager.getRepository(SocketUserOrm).findOneBy({ id: userId });
    if (!user) throw new NotFoundException('El usuario no está registrado en el chat.');
    return user;
  }
}
