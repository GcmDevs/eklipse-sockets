import { CustomDecorator, SetMetadata } from '@nestjs/common';

export function Authorities(authorities: string[] = []): CustomDecorator<string> {
  return SetMetadata('authorities', authorities);
}
