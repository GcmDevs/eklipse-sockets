import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ChatAccessSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  query = '';
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2, 3])
  typeCode?: number;
}
export class ChatAccessUserParams {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId: number;
}
export class ChatAccessLinkParams extends ChatAccessUserParams {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  contactId: number;
}
export class UpdateChatAccessDto {
  @IsBoolean() incomingRestricted: boolean;
  @IsBoolean() contactsRestricted: boolean;
  @IsBoolean() discoverAll: boolean;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  contactUserIds: number[];
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  revision: string;
}
