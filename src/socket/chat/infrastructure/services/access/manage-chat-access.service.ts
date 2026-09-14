import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Brackets, In, SelectQueryBuilder } from 'typeorm';
import { switchSocketsConn } from '@common/infrastructure/services';
import { fetchAuthsByUser } from '@common/infrastructure/services/authorities';
import { JWTServices } from '@common/application/services';
import { ADMINS } from '@common/application/constants';
import { TIPOS_USUARIO } from '@common/domain/types';
import { GEN_AUTHS } from '@authorities';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';
import { ChatAccessContactOrm, ChatAccessLinkOrm, ChatAccessPolicyOrm } from '../../orm';
import { ChatAccessPolicy, ChatAccessService } from './service';

const publicUser = (user: SocketUserOrm) => ({
  id: user.id,
  document: user.document,
  name: user.fullName,
  typeCode: user.typeCode,
});

type ChatManagementScope = {
  users: boolean;
  patients: boolean;
  currentDocument: string;
};

const tokenFrom = (authorization: string) => authorization?.split(' ')[1] ?? '';

@Injectable()
export class ManageChatAccessService {
  constructor(private readonly access: ChatAccessService) {}

  async search(authorization: string, query: string, page: number, typeCode?: number) {
    const scope = await this.scopeFor(authorization);
    const term = query.trim().replace(/[!%_]/g, value => `!${value}`);
    const builder = switchSocketsConn().getRepository(SocketUserOrm).createQueryBuilder('user');
    if (term)
      builder.where(
        "(user.document ILIKE :term ESCAPE '!' OR user.fullName ILIKE :term ESCAPE '!')",
        { term: `%${term}%` }
      );

    this.applyScope(builder, scope, typeCode);
    const [users, total] = await builder
      .orderBy('user.fullName', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * 20)
      .take(20)
      .getManyAndCount();
    return { users: users.map(publicUser), total, page, pageSize: 20 };
  }

  async detailsFor(authorization: string, userId: number) {
    await this.requireManageableUser(authorization, userId);
    return this.details(userId);
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

  async updateFor(
    authorization: string,
    userId: number,
    policy: ChatAccessPolicy,
    contactUserIds: number[],
    revision: string
  ) {
    await this.requireManageableUser(authorization, userId);
    return this.update(userId, policy, contactUserIds, revision);
  }

  async revokeLink(userId: number, contactId: number) {
    if (userId === contactId) throw new BadRequestException('Los usuarios deben ser diferentes.');
    await Promise.all([this.requireUser(userId), this.requireUser(contactId)]);
    await this.access.revokeLink(userId, contactId);
    return { success: true };
  }

  async revokeLinkFor(authorization: string, userId: number, contactId: number) {
    await this.requireManageableUser(authorization, userId);
    return this.revokeLink(userId, contactId);
  }

  private async requireManageableUser(authorization: string, userId: number): Promise<void> {
    const scope = await this.scopeFor(authorization);
    const user = await this.requireUser(userId);
    const userType = Number(user.typeCode);
    const manageable =
      (scope.users && userType === TIPOS_USUARIO.USUARIO.getCode()) ||
      (scope.patients && userType === TIPOS_USUARIO.PACIENTE.getCode()) ||
      (scope.patients && user.document === scope.currentDocument);
    if (!manageable) {
      throw new ForbiddenException('No tienes permiso para gestionar este tipo de usuario.');
    }
  }

  private async scopeFor(authorization: string): Promise<ChatManagementScope> {
    const token = tokenFrom(authorization);
    const decoded = JWTServices.decodeToken(token);

    const codes = (await fetchAuthsByUser({ tk: token })).onlyCodes;
    const all = codes.includes(GEN_AUTHS.chat.relacionesChatAll);
    const users = all || codes.includes(GEN_AUTHS.chat.relacionesChatUsuario);
    const patients = all || codes.includes(GEN_AUTHS.chat.relacionesChatPaciente);
    if (!users && !patients)
      throw new ForbiddenException('No tienes permiso para gestionar relaciones del chat.');
    return { users, patients, currentDocument: decoded.user.document };
  }

  private applyScope(
    builder: SelectQueryBuilder<SocketUserOrm>,
    scope: ChatManagementScope,
    requestedTypeCode?: number
  ): void {
    const userCode = TIPOS_USUARIO.USUARIO.getCode();
    const patientCode = TIPOS_USUARIO.PACIENTE.getCode();
    builder.andWhere(
      new Brackets(where => {
        if (scope.users && scope.patients) {
          where.where('user.typeCode IN (:...allowedTypeCodes)', {
            allowedTypeCodes: [userCode, patientCode],
          });
        } else if (scope.users) {
          where.where('user.typeCode = :allowedUserCode', { allowedUserCode: userCode });
        } else {
          where.where('(user.typeCode = :allowedPatientCode OR user.document = :currentDocument)', {
            allowedPatientCode: patientCode,
            currentDocument: scope.currentDocument,
          });
        }
      })
    );

    if (requestedTypeCode !== undefined) {
      builder.andWhere('user.typeCode = :requestedTypeCode', { requestedTypeCode });
    }
  }

  private async requireUser(userId: number, manager = switchSocketsConn().manager) {
    const user = await manager.getRepository(SocketUserOrm).findOneBy({ id: userId });
    if (!user) throw new NotFoundException('El usuario no está registrado en el chat.');
    return user;
  }
}
