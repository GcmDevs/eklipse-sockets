import { Body, Controller, Delete, Get, Headers, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorities, CommonGuards } from '@common/presentation/decorators';
import { ManageChatAccessService } from '../../infrastructure/services/access';
import {
  ChatAccessLinkParams,
  ChatAccessSearchDto,
  ChatAccessUserParams,
  UpdateChatAccessDto,
} from '../dtos';
import { GEN_AUTHS } from '@authorities';

const CHAT_RELATION_AUTHORITIES = [
  GEN_AUTHS.chat.relacionesChatUsuario,
  GEN_AUTHS.chat.relacionesChatPaciente,
  GEN_AUTHS.chat.relacionesChatAll,
];

@ApiTags('Relaciones del chat')
@CommonGuards()
@Controller('chat/access')
export class ChatAccessController {
  constructor(private readonly admin: ManageChatAccessService) {}

  @Authorities(CHAT_RELATION_AUTHORITIES)
  @Get('users')
  @ApiOperation({ summary: 'Buscar usuarios y pacientes para administrar sus relaciones' })
  search(@Headers('authorization') authorization: string, @Query() query: ChatAccessSearchDto) {
    return this.admin.search(authorization, query.query, query.page, query.typeCode);
  }

  @Authorities(CHAT_RELATION_AUTHORITIES)
  @Get('users/:userId')
  @ApiOperation({ summary: 'Consultar política, contactos permitidos y enlaces' })
  details(@Headers('authorization') authorization: string, @Param() params: ChatAccessUserParams) {
    return this.admin.detailsFor(authorization, params.userId);
  }

  @Authorities(CHAT_RELATION_AUTHORITIES)
  @Put('users/:userId')
  @ApiOperation({ summary: 'Reemplazar política y contactos permitidos' })
  update(
    @Headers('authorization') authorization: string,
    @Param() params: ChatAccessUserParams,
    @Body() body: UpdateChatAccessDto
  ) {
    return this.admin.updateFor(
      authorization,
      params.userId,
      body,
      body.contactUserIds,
      body.revision
    );
  }

  @Authorities(CHAT_RELATION_AUTHORITIES)
  @Delete('users/:userId/links/:contactId')
  @ApiOperation({ summary: 'Retirar un enlace creado por una conversación' })
  revoke(@Headers('authorization') authorization: string, @Param() params: ChatAccessLinkParams) {
    return this.admin.revokeLinkFor(authorization, params.userId, params.contactId);
  }
}
