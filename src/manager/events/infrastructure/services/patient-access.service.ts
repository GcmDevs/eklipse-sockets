import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { JWTServices, CRYPTO_SERVICES } from '@common/application/services';
import { switchConn } from '@common/infrastructure/services';
import { _PrivSecPacAreaOrm } from '@common/infrastructure/orm/patient-area.orm';
import { _PrivSecPacAsUserOrm } from '@common/infrastructure/orm/patient-as-user.orm';
import { _PrivSecPacOrm } from '@common/infrastructure/orm/patient.orm';

const PAGE_SIZE = 20;
const tokenFrom = (authorization: string) => authorization?.split(' ')[1] ?? '';
const escapeLike = (value: string) => value.trim().replace(/[!%_[]/g, char => `!${char}`);

@Injectable()
export class PatientAccessService {
  async areas(authorization: string) {
    const conn = this.connection(authorization);
    const areas = await conn.getRepository(_PrivSecPacAreaOrm).find({ order: { nombre: 'ASC' } });
    return areas.map(area => ({ id: Number(area.id), code: area.codigo, name: area.nombre }));
  }

  async candidates(authorization: string, query: string, page: number) {
    const conn = this.connection(authorization);
    const term = escapeLike(query);
    const registered = conn.getRepository(_PrivSecPacAsUserOrm).createQueryBuilder('registered');
    const builder = conn
      .getRepository(_PrivSecPacOrm)
      .createQueryBuilder('patient')
      .where(
        `NOT EXISTS (${registered.select('1').where('registered.pacientId = patient.id').getQuery()})`
      );
    if (term) {
      builder.andWhere(
        "(patient.documento LIKE :term ESCAPE '!' OR patient.nombreCompleto LIKE :term ESCAPE '!')",
        { term: `%${term}%` }
      );
    }
    const [patients, total] = await builder
      .orderBy('patient.nombreCompleto', 'ASC')
      .addOrderBy('patient.id', 'ASC')
      .skip((page - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getManyAndCount();
    return {
      patients: patients.map(patient => ({
        id: Number(patient.id),
        document: patient.documento,
        name: patient.nombreCompleto,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async users(authorization: string, query: string, page: number) {
    const conn = this.connection(authorization);
    const term = escapeLike(query);
    const builder = conn
      .getRepository(_PrivSecPacAsUserOrm)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.areas', 'area');
    if (term) {
      builder.where(
        "(user.document LIKE :term ESCAPE '!' OR user.fullName LIKE :term ESCAPE '!')",
        { term: `%${term}%` }
      );
    }
    const [users, total] = await builder
      .orderBy('user.fullName', 'ASC')
      .addOrderBy('area.nombre', 'ASC')
      .skip((page - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getManyAndCount();
    return { users: users.map(user => this.publicUser(user)), total, page, pageSize: PAGE_SIZE };
  }

  async create(authorization: string, patientId: number, areaIds: number[]) {
    const conn = this.connection(authorization);
    try {
      return await conn.transaction('SERIALIZABLE', async manager => {
        const patient = await manager.getRepository(_PrivSecPacOrm).findOneBy({ id: patientId });
        if (!patient) throw new NotFoundException('El paciente seleccionado ya no existe.');
        const repository = manager.getRepository(_PrivSecPacAsUserOrm);
        const duplicate = await repository.findOne({
          where: [{ pacientId: patientId }, { document: patient.documento }],
        });
        if (duplicate) throw new ConflictException('El paciente ya está registrado como usuario.');
        const areas = await this.requireAreas(manager.getRepository(_PrivSecPacAreaOrm), areaIds);
        const user = repository.create({
          pacientId: Number(patient.id),
          document: patient.documento,
          fullName: patient.nombreCompleto,
          password: await CRYPTO_SERVICES.encrypt('123'),
          statusCode: 1,
          lastAuth: new Date(),
          passwordIsReset: true,
          areas,
        });
        return this.publicUser(await repository.save(user));
      });
    } catch (error: any) {
      if (error?.number === 2601 || error?.number === 2627) {
        throw new ConflictException('El paciente ya está registrado como usuario.');
      }
      throw error;
    }
  }

  async updateAreas(authorization: string, userId: number, areaIds: number[]) {
    const conn = this.connection(authorization);
    return conn.transaction(async manager => {
      const repository = manager.getRepository(_PrivSecPacAsUserOrm);
      const user = await repository.findOne({ where: { id: userId }, relations: { areas: true } });
      if (!user) throw new NotFoundException('El paciente usuario ya no existe.');
      user.areas = await this.requireAreas(manager.getRepository(_PrivSecPacAreaOrm), areaIds);
      return this.publicUser(await repository.save(user));
    });
  }

  private connection(authorization: string) {
    return switchConn(JWTServices.decodeToken(tokenFrom(authorization)).context);
  }

  private async requireAreas(repository: any, areaIds: number[]) {
    const areas = await repository.find({ where: { id: In(areaIds) }, order: { nombre: 'ASC' } });
    if (areas.length !== areaIds.length) {
      throw new BadRequestException('Una de las áreas seleccionadas ya no está disponible.');
    }
    return areas as _PrivSecPacAreaOrm[];
  }

  private publicUser(user: _PrivSecPacAsUserOrm) {
    return {
      id: Number(user.id),
      patientId: Number(user.pacientId),
      document: user.document,
      name: user.fullName,
      statusCode: Number(user.statusCode),
      areas: (user.areas ?? []).map(area => ({
        id: Number(area.id),
        code: area.codigo,
        name: area.nombre,
      })),
    };
  }
}
