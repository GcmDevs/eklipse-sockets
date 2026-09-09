import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PatientAccessSearchDto {
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
}

export class CreatePatientAccessDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  patientId: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  areaIds: number[];
}

export class UpdatePatientAreasDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  areaIds: number[];
}

export class PatientAccessParams {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId: number;
}
