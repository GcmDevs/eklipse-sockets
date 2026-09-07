import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorities, CommonGuards } from '@common/presentation/decorators';
import { ManageChatAccessService } from '../../infrastructure/services/access';
import {
  ChatAccessLinkParams,
  ChatAccessSearchDto,
  ChatAccessUserParams,
  UpdateChatAccessDto,
} from '../dtos';

@ApiTags('Relaciones del chat')
@CommonGuards()
@Controller('chat/access')
export class ChatAccessController {
  constructor(private readonly admin: ManageChatAccessService) {}

  @Authorities()
  @Get('users')
  @ApiOperation({ summary: 'Buscar usuarios y pacientes para administrar sus relaciones' })
  search(@Query() query: ChatAccessSearchDto) {
    return this.admin.search(query.query, query.page, query.typeCode);
  }

  @Authorities()
  @Get('users/:userId')
  @ApiOperation({ summary: 'Consultar política, contactos permitidos y enlaces' })
  details(@Param() params: ChatAccessUserParams) {
    return this.admin.details(params.userId);
  }

  @Authorities()
  @Put('users/:userId')
  @ApiOperation({ summary: 'Reemplazar política y contactos permitidos' })
  update(@Param() params: ChatAccessUserParams, @Body() body: UpdateChatAccessDto) {
    return this.admin.update(params.userId, body, body.contactUserIds, body.revision);
  }

  @Authorities()
  @Delete('users/:userId/links/:contactId')
  @ApiOperation({ summary: 'Retirar un enlace creado por una conversación' })
  revoke(@Param() params: ChatAccessLinkParams) {
    return this.admin.revokeLink(params.userId, params.contactId);
  }
}
