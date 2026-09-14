import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorities, CommonGuards } from '@common/presentation/decorators';
import { PatientAccessService } from '../../infrastructure/services';
import {
  PatientAccessSearchDto,
  CreatePatientAccessDto,
  PatientAccessParams,
  UpdatePatientAreasDto,
} from '../dtos';
import { GEN_AUTHS } from '@authorities';

@ApiTags('Acceso de pacientes a eventos')
@CommonGuards()
@Controller('events/patient-access')
export class PatientAccessController {
  constructor(private readonly service: PatientAccessService) {}

  @Authorities([
    GEN_AUTHS.pacientes.habilitarPacienteApp,
    GEN_AUTHS.pacientes.addPacienteToArea,
  ])
  @Get('areas')
  @ApiOperation({ summary: 'Listar áreas disponibles para pacientes' })
  areas(@Headers('authorization') authorization: string) {
    return this.service.areas(authorization);
  }

  @Authorities([GEN_AUTHS.pacientes.habilitarPacienteApp])
  @Get('candidates')
  @ApiOperation({ summary: 'Buscar pacientes que aún no son usuarios' })
  candidates(
    @Headers('authorization') authorization: string,
    @Query() query: PatientAccessSearchDto
  ) {
    return this.service.candidates(authorization, query.query, query.page);
  }

  @Authorities([GEN_AUTHS.pacientes.addPacienteToArea])
  @Get('users')
  @ApiOperation({ summary: 'Buscar pacientes registrados como usuarios' })
  users(@Headers('authorization') authorization: string, @Query() query: PatientAccessSearchDto) {
    return this.service.users(authorization, query.query, query.page);
  }

  @Authorities([GEN_AUTHS.pacientes.habilitarPacienteApp])
  @Post('users')
  @ApiOperation({ summary: 'Registrar un paciente como usuario y asignarle áreas' })
  create(@Headers('authorization') authorization: string, @Body() body: CreatePatientAccessDto) {
    return this.service.create(authorization, body.patientId, body.areaIds);
  }

  @Authorities([GEN_AUTHS.pacientes.addPacienteToArea])
  @Put('users/:userId/areas')
  @ApiOperation({ summary: 'Reemplazar las áreas asignadas a un paciente usuario' })
  updateAreas(
    @Headers('authorization') authorization: string,
    @Param() params: PatientAccessParams,
    @Body() body: UpdatePatientAreasDto
  ) {
    return this.service.updateAreas(authorization, params.userId, body.areaIds);
  }
}
