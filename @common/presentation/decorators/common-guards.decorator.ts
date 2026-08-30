import { ApiBearerAuth } from '@nestjs/swagger';
import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthoritiesGuard, JwtAuthGuard } from '../../infrastructure/guards';

export function CommonGuards() {
  return applyDecorators(UseGuards(JwtAuthGuard, AuthoritiesGuard), ApiBearerAuth());
}
